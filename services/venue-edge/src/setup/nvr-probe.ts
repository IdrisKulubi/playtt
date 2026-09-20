import { connect } from "node:net"

import { probeCodec, type CodecProbeResult } from "../ffmpeg/probe"
import { redactStringSecrets } from "../health/metrics"
import { buildVigiPlaybackUrl } from "../video-adapters/vigi-urls"
import type { LocalNvrRow, LocalNvrTimeMode } from "../local-storage/local-nvr-types"

export interface NvrProbeCheckResult {
  check: string
  passed: boolean
  code?: string
  message: string
}

export interface NvrProbeSuiteResult {
  passed: boolean
  timeMode: LocalNvrTimeMode
  diagnostic?: NvrProbeDiagnostic
  checks: NvrProbeCheckResult[]
}

export interface NvrProbeDiagnostic {
  code: string
  summary: string
  action: string
  exitCode: number | null
  timedOut: boolean
  detectedCodec: string | null
  output: string | null
}

export interface NvrProbeInput {
  nvr: LocalNvrRow
  password: string
  liveRtspUrl: string
  scope?: "connection" | "full"
}

export interface NvrProbeRunner {
  run(input: NvrProbeInput): Promise<NvrProbeSuiteResult>
}

const CLOCK_SKEW_THRESHOLD_MS = 5_000
const TCP_TIMEOUT_MS = 3_000
const PLAYBACK_WINDOW_SECONDS = 10

function checkResult(
  check: string,
  passed: boolean,
  message: string,
  code?: string,
): NvrProbeCheckResult {
  return { check, passed, message, ...(code ? { code } : {}) }
}

async function tcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: TCP_TIMEOUT_MS })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export function parseClockSkewMs(probeOutput: string): number | null {
  const creationMatch = probeOutput.match(
    /creation_time[=:]\s*([0-9T:\-.Z+]+)/i,
  )
  if (!creationMatch?.[1]) {
    return null
  }

  const parsed = Date.parse(creationMatch[1])
  if (Number.isNaN(parsed)) {
    return null
  }

  return Math.abs(Date.now() - parsed)
}

function authFailed(stderr: string): boolean {
  return /401|403|unauthorized|authentication failed|access denied/i.test(stderr)
}

function safeProbeOutput(raw: string): string | null {
  const lines = redactStringSecrets(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length > 0 ? lines.slice(-12).join("\n").slice(-2_500) : null
}

// FFmpeg exits with its negative AVERROR code, which Windows reports as an
// unsigned 32-bit value. FFERRTAG(a,b,c,d) = -(a | b<<8 | c<<16 | d<<24).
function ffErrTagExitCode(lead: number, b: string, c: string, d: string): number {
  const tag =
    (lead |
      (b.charCodeAt(0) << 8) |
      (c.charCodeAt(0) << 16) |
      (d.charCodeAt(0) << 24)) >>>
    0
  return (0x1_0000_0000 - tag) >>> 0
}

// RTSP replies are mapped onto FFmpeg's HTTP status AVERRORs, so the exit code
// identifies why the recorder refused the stream.
const RTSP_STATUS_DIAGNOSTICS = new Map<
  number,
  Pick<NvrProbeDiagnostic, "code" | "summary" | "action">
>([
  [
    ffErrTagExitCode(0xf8, "5", "X", "X"),
    {
      code: "source_busy",
      summary: "The recorder refused a new RTSP session and returned a 5xx error.",
      action: "This recorder allows only a few simultaneous streams. Close live views and any other viewer, wait a few seconds, then try again.",
    },
  ],
  [
    ffErrTagExitCode(0xf8, "4", "0", "4"),
    {
      code: "channel_not_found",
      summary: "The recorder has no stream at this channel and stream profile.",
      action: "Confirm the channel number and that its main stream is enabled on the recorder, then try again.",
    },
  ],
  [
    ffErrTagExitCode(0xf8, "4", "0", "3"),
    {
      code: "source_auth_failed",
      summary: "The recorder refused access to this channel.",
      action: "Confirm the dedicated NVR account may view this channel, then try again.",
    },
  ],
  [
    ffErrTagExitCode(0xf8, "4", "0", "1"),
    {
      code: "source_auth_failed",
      summary: "The recorder rejected the RTSP username or password.",
      action: "Re-enter the dedicated NVR credentials, then test again.",
    },
  ],
  [
    ffErrTagExitCode(0xf8, "4", "0", "0"),
    {
      code: "source_request_rejected",
      summary: "The recorder rejected the RTSP request as malformed.",
      action: "Confirm the channel number and stream profile, then try again.",
    },
  ],
  [
    ffErrTagExitCode(0xf8, "4", "X", "X"),
    {
      code: "source_request_rejected",
      summary: "The recorder rejected the RTSP request with a 4xx error.",
      action: "Confirm the channel number and stream profile, then try again.",
    },
  ],
])

export function diagnoseCodecProbe(probe: CodecProbeResult): NvrProbeDiagnostic {
  const base = { exitCode: probe.exitCode, timedOut: probe.timedOut, detectedCodec: probe.codec, output: safeProbeOutput(probe.raw) }
  if (authFailed(probe.raw)) return { ...base, code: "source_auth_failed", summary: "The NVR rejected the RTSP username or password.", action: "Re-enter the dedicated NVR credentials, then test again." }
  if (probe.timedOut) return { ...base, code: "probe_timed_out", summary: "The stream produced no video within 15 seconds.", action: "Stop other live viewers, confirm the camera is online, then test again." }
  if (probe.cancelled) return { ...base, code: "probe_cancelled", summary: "The camera check was cancelled before video arrived.", action: "Run the camera check again." }
  if (probe.exitCode !== 0) {
    const rtspStatus = probe.exitCode === null ? undefined : RTSP_STATUS_DIAGNOSTICS.get(probe.exitCode)
    if (rtspStatus) return { ...base, ...rtspStatus }
    return { ...base, code: "ffmpeg_failed", summary: `FFmpeg could not open the camera stream (exit code ${probe.exitCode ?? "unknown"}).`, action: "Open Technical details and use the final FFmpeg lines to correct the stream or channel settings." }
  }
  if (!probe.codec) return { ...base, code: "video_stream_missing", summary: "The RTSP connection returned no detectable video track.", action: "Confirm the channel and main stream are enabled on the NVR, then test again." }
  if (!probe.compatible) return { ...base, code: "codec_incompatible", summary: `The stream uses ${probe.codec.toUpperCase()}, but replay capture currently requires H.264.`, action: "Change this camera's main stream encoding to H.264 on the NVR, then test again." }
  return { ...base, code: "ok", summary: `Live ${probe.codec.toUpperCase()} video was detected.`, action: "No action is needed." }
}

export class DefaultNvrProbeRunner implements NvrProbeRunner {
  async run(input: NvrProbeInput): Promise<NvrProbeSuiteResult> {
    const checks: NvrProbeCheckResult[] = []
    let timeMode: LocalNvrTimeMode = input.nvr.timeMode

    const reachable = await tcpReachable(input.nvr.host, input.nvr.rtspPort)
    checks.push(
      checkResult(
        "reachability",
        reachable,
        reachable
          ? "NVR TCP port is reachable."
          : "Unreachable — check LAN IP, routing, and firewall rules.",
        reachable ? undefined : "nvr_unreachable",
      ),
    )

    if (!reachable) {
      return { passed: false, timeMode, diagnostic: { code: "nvr_unreachable", summary: "The venue PC cannot reach the NVR RTSP port.", action: "Check the NVR IP address, RTSP port, network cable, and Windows firewall.", exitCode: null, timedOut: false, detectedCodec: null, output: null }, checks }
    }

    const codecProbe = await probeCodec(input.liveRtspUrl)
    const combined = codecProbe.raw
    const diagnostic = diagnoseCodecProbe(codecProbe)

    if (authFailed(combined)) {
      checks.push(
        checkResult(
          "authentication",
          false,
          "Authentication failed — verify the dedicated NVR username and password.",
          "source_auth_failed",
        ),
      )
      return { passed: false, timeMode, diagnostic, checks }
    }

    const streamResponded = codecProbe.codec !== null
    checks.push(
      checkResult(
        "authentication",
        true,
        streamResponded
          ? "NVR accepted RTSP credentials."
          : "The NVR did not report an authentication error.",
      ),
    )

    const liveOk = streamResponded
    checks.push(
      checkResult(
        "live_rtsp",
        liveOk,
        liveOk
          ? "Live RTSP stream responded."
          : "Live RTSP failed — verify channel number and that the stream is enabled.",
        liveOk ? undefined : "channel_unavailable",
      ),
    )

    if (input.scope === "connection") {
      return {
        passed: liveOk,
        timeMode,
        diagnostic,
        checks,
      }
    }

    checks.push(
      checkResult(
        "codec",
        codecProbe.compatible,
        codecProbe.compatible
          ? `Codec ${codecProbe.codec ?? "h264"} is compatible.`
          : codecProbe.codec
            ? `Unsupported codec ${codecProbe.codec} — PlayTT requires H.264 for v1 capture.`
            : "Codec check skipped because no live video track was detected.",
        codecProbe.compatible ? undefined : codecProbe.codec ? "codec_incompatible" : "codec_not_detected",
      ),
    )

    const skewMs = parseClockSkewMs(combined)
    if (skewMs === null) {
      checks.push(
        checkResult(
          "clock_skew",
          false,
          streamResponded
            ? "The stream did not expose a timestamp. Verify NTP on the NVR."
            : "Clock check skipped because no live video track was detected.",
          "clock_skew_unavailable",
        ),
      )
    } else {
      const skewOk = skewMs <= CLOCK_SKEW_THRESHOLD_MS
      checks.push(
        checkResult(
          "clock_skew",
          skewOk,
          skewOk
            ? `Clock skew ${Math.round(skewMs / 1000)}s is within tolerance.`
            : `Clock skew ${Math.round(skewMs / 1000)}s — sync NTP on the NVR.`,
          skewOk ? undefined : "clock_skew",
        ),
      )
    }

    const end = new Date()
    const start = new Date(end.getTime() - PLAYBACK_WINDOW_SECONDS * 1000)
    let playbackPassed = false
    let playbackMessage =
      "Recorded playback failed — try the alternate time mode (UTC vs local)."

    for (const suffix of ["z", "l"] as const) {
      const playbackUrl = buildVigiPlaybackUrl(
        input.liveRtspUrl,
        start,
        end,
        suffix,
      )
      if (!playbackUrl) {
        continue
      }

      const playbackProbe = await probeCodec(playbackUrl)
      if (authFailed(playbackProbe.raw)) {
        continue
      }

      if (playbackProbe.compatible || playbackProbe.codec) {
        playbackPassed = true
        timeMode = suffix
        playbackMessage = `Recorded playback succeeded with ${suffix === "z" ? "UTC" : "local"} time mode.`
        break
      }
    }

    checks.push(
      checkResult(
        "playback",
        playbackPassed,
        playbackMessage,
        playbackPassed ? undefined : "playback_failed",
      ),
    )

    const blocking = new Set([
      "reachability",
      "authentication",
      "live_rtsp",
      "codec",
    ])
    const passed = checks
      .filter((entry) => blocking.has(entry.check))
      .every((entry) => entry.passed)
    return { passed, timeMode, diagnostic, checks }
  }
}

export async function tcpDiscoverHost(
  host: string,
  port: number,
): Promise<{ reachable: boolean; message: string }> {
  const reachable = await tcpReachable(host, port)
  return {
    reachable,
    message: reachable
      ? "TCP port is reachable on the venue LAN."
      : "TCP port is not reachable — verify IP, port, and firewall.",
  }
}
