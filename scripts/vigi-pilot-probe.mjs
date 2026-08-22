/**
 * VIGI NVR pilot probe — run on venue LAN with FFmpeg installed.
 *
 * Usage:
 *   VIGI_NVR_IP=192.168.1.50 VIGI_RTSP_USER=admin VIGI_RTSP_PASS=secret pnpm probe:vigi
 *
 * Optional:
 *   VIGI_CHANNEL=1 VIGI_STREAM=1 VIGI_TIME_SUFFIX=z|l
 *   VIGI_CAPTURE_AT=2026-08-22T09:00:00.000Z  (UTC instant for 12+3 window)
 *   VIGI_PRE_ROLL_SECONDS=12 VIGI_POST_ROLL_SECONDS=3
 */

import { spawn } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const PRE_ROLL = Number(process.env.VIGI_PRE_ROLL_SECONDS ?? "12")
const POST_ROLL = Number(process.env.VIGI_POST_ROLL_SECONDS ?? "3")

function resolveMediaBinary(name, configuredPath) {
  if (configuredPath?.trim()) {
    return configuredPath.trim()
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const wingetLink = join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "WinGet",
      "Links",
      `${name}.exe`,
    )

    if (existsSync(wingetLink)) {
      return wingetLink
    }
  }

  return name
}

const FFPROBE_BINARY = resolveMediaBinary(
  "ffprobe",
  process.env.FFPROBE_PATH,
)
const FFMPEG_BINARY = resolveMediaBinary("ffmpeg", process.env.FFMPEG_PATH)

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return value
}

function run(cmd, args, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let settled = false

    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })

    const finish = (error, value) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)

      if (error) {
        reject(error)
        return
      }

      resolve(value)
    }

    const timer = setTimeout(() => {
      child.kill()
      finish(
        new Error(
          `${cmd} timed out after ${timeoutMs}ms. After changing H.264 encoding, wait 1–2 minutes and retry; the NVR stream often restarts.`,
        ),
      )
    }, timeoutMs)

    child.on("close", (code) => {
      finish(null, { code, stdout, stderr })
    })

    child.on("error", () => {
      finish(
        new Error(
          `Could not start ${cmd}. Install FFmpeg, reopen the terminal, or set its explicit path in .env.local.`,
        ),
      )
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodeRtspCredential(value) {
  return encodeURIComponent(value).replace(/!/g, "%21")
}

function buildRtspUrl(input) {
  const auth =
    input.user && input.pass
      ? `${encodeRtspCredential(input.user)}:${encodeRtspCredential(input.pass)}@`
      : ""

  return `rtsp://${auth}${input.host}${input.path}`
}

function formatVigiTime(date, suffix) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  const h = String(date.getUTCHours()).padStart(2, "0")
  const min = String(date.getUTCMinutes()).padStart(2, "0")
  const s = String(date.getUTCSeconds()).padStart(2, "0")

  if (suffix === "l") {
    // Local suffix: use local wall-clock components (pilot must verify firmware support).
    const ly = date.getFullYear()
    const lm = String(date.getMonth() + 1).padStart(2, "0")
    const ld = String(date.getDate()).padStart(2, "0")
    const lh = String(date.getHours()).padStart(2, "0")
    const lmin = String(date.getMinutes()).padStart(2, "0")
    const ls = String(date.getSeconds()).padStart(2, "0")
    return `${ly}${lm}${ld}t${lh}${lmin}${ls}l`
  }

  return `${y}${m}${d}t${h}${min}${s}z`
}

async function probeStream(label, url) {
  const args = [
    "-rtsp_transport",
    "tcp",
    "-analyzeduration",
    "2000000",
    "-probesize",
    "500000",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height,r_frame_rate",
    "-of",
    "json",
    url,
  ]

  let lastError = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`${label} probe attempt ${attempt}/3…`)
      const result = await run(FFPROBE_BINARY, args, 20_000)
      const combined = `${result.stdout}\n${result.stderr}`

      if (result.code === 0 && result.stdout.trim()) {
        return parseProbeResult(label, result)
      }

      lastError = combined.trim() || `ffprobe exited ${result.code}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    if (attempt < 3) {
      await sleep(4000)
    }
  }

  return {
    label,
    ok: false,
    error: lastError,
  }
}

function parseProbeResult(label, result) {

  const combined = `${result.stdout}\n${result.stderr}`

  if (result.code !== 0) {
    return {
      label,
      ok: false,
      error: combined.trim().slice(0, 500),
    }
  }

  try {
    const parsed = JSON.parse(result.stdout)
    const stream = parsed.streams?.[0] ?? {}
    const codec = stream.codec_name ?? "unknown"

    return {
      label,
      ok: true,
      codec,
      h264Compatible: codec === "h264",
      width: stream.width,
      height: stream.height,
      frameRate: stream.r_frame_rate,
    }
  } catch {
    return {
      label,
      ok: false,
      error: "Could not parse ffprobe JSON",
      raw: combined.slice(0, 500),
    }
  }
}

async function extractPlaybackClip(url, outputPath, codec) {
  const outputOptions = [
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-ac",
    "1",
    "-ar",
    "16000",
  ]

  if (codec === "hevc") {
    outputOptions.push("-tag:v", "hvc1")
  }

  const result = await run(
    FFMPEG_BINARY,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      url,
      ...outputOptions,
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ],
    120_000,
  )

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "ffmpeg extract failed")
  }
}

async function main() {
  const nvrIp = required("VIGI_NVR_IP")
  const rtspPort = process.env.VIGI_RTSP_PORT?.trim() ?? "554"
  const host = rtspPort === "554" ? nvrIp : `${nvrIp}:${rtspPort}`
  const user = process.env.VIGI_RTSP_USER?.trim() ?? ""
  const pass = process.env.VIGI_RTSP_PASS?.trim() ?? ""
  const channel = process.env.VIGI_CHANNEL?.trim() ?? "1"
  const stream = process.env.VIGI_STREAM?.trim() ?? "1"
  const timeSuffix = process.env.VIGI_TIME_SUFFIX?.trim() === "l" ? "l" : "z"

  const captureAt = process.env.VIGI_CAPTURE_AT
    ? new Date(process.env.VIGI_CAPTURE_AT)
    : new Date(Date.now() - 60_000)

  if (Number.isNaN(captureAt.getTime())) {
    console.error("Invalid VIGI_CAPTURE_AT — use ISO-8601 UTC")
    process.exit(1)
  }

  const start = new Date(
    captureAt.getTime() - PRE_ROLL * 1000,
  )
  const end = new Date(captureAt.getTime() + POST_ROLL * 1000)

  const livePath = `/live/${channel}/${stream}/avm`
  const playbackPath = `/replay/${channel}/${stream}/avm?starttime=${formatVigiTime(start, timeSuffix)}&endtime=${formatVigiTime(end, timeSuffix)}`

  const liveUrl = buildRtspUrl({ host, user, pass, path: livePath })
  const playbackUrl = buildRtspUrl({ host, user, pass, path: playbackPath })

  console.log("VIGI pilot probe")
  console.log("================")
  console.log(`NVR host: ${nvrIp}, RTSP port: ${rtspPort}`)
  console.log(`NVR model: ${process.env.VIGI_NVR_MODEL ?? "not recorded"}`)
  console.log(`NVR firmware: ${process.env.VIGI_NVR_FIRMWARE ?? "not recorded"}`)
  console.log(`Channel: ${channel}, stream: ${stream}, time suffix: ${timeSuffix}`)
  console.log(`Capture window: ${start.toISOString()} → ${end.toISOString()}`)
  console.log(`Live path: ${livePath}`)
  console.log(`Playback path: ${playbackPath}`)
  console.log("")

  const liveProbe = await probeStream("live", liveUrl)
  console.log("Live probe:", JSON.stringify(liveProbe, null, 2))

  const playbackProbe = await probeStream("playback", playbackUrl)
  console.log("Playback probe:", JSON.stringify(playbackProbe, null, 2))

  const outputPath = join(process.cwd(), "pilot-playback-clip.mp4")
  let clipOk = false
  let clipError = null

  if (playbackProbe.ok) {
    try {
      await extractPlaybackClip(playbackUrl, outputPath, playbackProbe.codec)
      clipOk = true
      console.log(`\nWrote clip: ${outputPath}`)
    } catch (error) {
      clipError =
        error instanceof Error ? error.message : String(error)
      console.error("\nClip extract failed:", clipError)
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    nvrModel: process.env.VIGI_NVR_MODEL ?? null,
    nvrFirmware: process.env.VIGI_NVR_FIRMWARE ?? null,
    cameraModel: process.env.VIGI_CAMERA_MODEL ?? null,
    cameraCount: Number(process.env.VIGI_CAMERA_COUNT ?? "0") || null,
    nvrIp,
    rtspPort: Number(rtspPort),
    rtspAuthentication: process.env.VIGI_RTSP_AUTH ?? null,
    srtpEnabled: process.env.VIGI_SRTP_ENABLED === "true",
    timeZone: process.env.VIGI_TIME_ZONE ?? null,
    channel,
    stream,
    timeSuffix,
    captureAt: captureAt.toISOString(),
    windowSeconds: PRE_ROLL + POST_ROLL,
    live: liveProbe,
    playback: playbackProbe,
    clipExtracted: clipOk,
    clipPath: clipOk ? outputPath : null,
    clipError,
    checklist: {
      modelFirmwareRecorded: "manual — see NVR web UI",
      liveRtsp: liveProbe.ok,
      playbackRtsp: playbackProbe.ok,
      h264Compatible: liveProbe.h264Compatible ?? playbackProbe.h264Compatible ?? false,
      clockSync: "manual — compare NVR UI vs wall clock",
      credentialRotation: "manual — rotate RTSP user and re-run",
      networkIsolation: "manual — verify NVR not on guest Wi‑Fi",
    },
  }

  const reportPath = join(process.cwd(), "vigi-pilot-report.json")
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.log(`\nReport: ${reportPath}`)

  const transportAndExtractionPass =
    liveProbe.ok && playbackProbe.ok && clipOk
  const browserCodecPass =
    liveProbe.h264Compatible && playbackProbe.h264Compatible

  if (!transportAndExtractionPass) {
    console.error(
      "\nPilot probe FAILED — inspect RTSP, authentication, playback time, or extraction errors above.",
    )
    process.exit(1)
  }

  if (!browserCodecPass) {
    console.error(
      "\nRTSP and playback extraction PASSED, but the stream is HEVC. Configure the camera/NVR replay stream as H.264 for browser-compatible PlayTT clips, then rerun.",
    )
    process.exit(2)
  }

  console.log("\nPilot probe PASSED automated checks. Complete manual checklist items in docs/hardware/vigi-nvr-pilot-checklist.md")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
