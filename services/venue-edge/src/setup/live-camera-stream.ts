import { spawn } from "node:child_process"
import type { IncomingMessage, ServerResponse } from "node:http"

import { resolveFfmpegBinary } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"

const LIVE_PREVIEW_MAX_MS = 10 * 60 * 1000
const activeStreams = new Map<string, () => void>()

export function stopAllLiveCameraStreams(): number {
  const streams = [...activeStreams.values()]
  for (const stop of streams) stop()
  return streams.length
}

export function streamCameraAsMjpeg(input: {
  req: IncomingMessage
  res: ServerResponse
  cameraId: string
  rtspUrl: string
}): void {
  // Browser image reloads are not guaranteed to close the previous HTTP stream
  // immediately. Replace the existing process first so one camera can consume at
  // most one recorder session, even across reloads or multiple wizard tabs.
  activeStreams.get(input.cameraId)?.()

  const child = spawn(
    resolveFfmpegBinary(),
    [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-rtsp_transport",
      "tcp",
      "-analyzeduration",
      "1000000",
      "-probesize",
      "300000",
      "-i",
      input.rtspUrl,
      "-map",
      "0:v:0",
      "-an",
      "-vf",
      "fps=4,scale=960:-2:force_original_aspect_ratio=decrease",
      "-c:v",
      "mjpeg",
      "-q:v",
      "6",
      "-f",
      "mpjpeg",
      "-boundary_tag",
      "venueedgeframe",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )

  let stderr = ""
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(maxTimer)
    if (activeStreams.get(input.cameraId) === stop) {
      activeStreams.delete(input.cameraId)
    }
    if (!child.killed) child.kill("SIGTERM")
    if (!input.res.writableEnded) input.res.end()
  }
  const maxTimer = setTimeout(stop, LIVE_PREVIEW_MAX_MS)
  activeStreams.set(input.cameraId, stop)

  input.res.statusCode = 200
  input.res.setHeader(
    "content-type",
    "multipart/x-mixed-replace; boundary=venueedgeframe",
  )
  input.res.setHeader("cache-control", "no-store, no-cache, must-revalidate")
  input.res.setHeader("x-content-type-options", "nosniff")

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_000)
  })
  child.stdout.pipe(input.res)

  child.on("error", (error) => {
    safeLog("warn", "Camera live view could not start", {
      cameraId: input.cameraId,
      message: error.message,
    })
    if (!input.res.writableEnded) input.res.end()
  })
  child.on("close", (exitCode) => {
    if (!stopped && exitCode !== 0) {
      safeLog("warn", "Camera live view stopped", {
        cameraId: input.cameraId,
        exitCode,
        stderr: stderr.trim() || undefined,
      })
    }
    if (!input.res.writableEnded) input.res.end()
  })

  input.req.on("aborted", stop)
  input.res.on("close", stop)
}
