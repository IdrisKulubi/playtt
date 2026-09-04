import { spawn } from "node:child_process"
import type { IncomingMessage, ServerResponse } from "node:http"

import { resolveFfmpegBinary } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"

const LIVE_PREVIEW_MAX_MS = 10 * 60 * 1000

export function streamCameraAsMjpeg(input: {
  req: IncomingMessage
  res: ServerResponse
  cameraId: string
  rtspUrl: string
}): void {
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
    if (!child.killed) child.kill("SIGTERM")
  }
  const maxTimer = setTimeout(stop, LIVE_PREVIEW_MAX_MS)

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
