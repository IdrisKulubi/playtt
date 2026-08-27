import { connect } from "node:net"

import { probeCodec } from "../ffmpeg/probe"
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
  checks: NvrProbeCheckResult[]
}

export interface NvrProbeInput {
  nvr: LocalNvrRow
  password: string
  liveRtspUrl: string
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
      return { passed: false, timeMode, checks }
    }

    const codecProbe = await probeCodec(input.liveRtspUrl)
    const combined = codecProbe.raw

    if (authFailed(combined)) {
      checks.push(
        checkResult(
          "authentication",
          false,
          "Authentication failed — verify the dedicated NVR username and password.",
          "source_auth_failed",
        ),
      )
      return { passed: false, timeMode, checks }
    }

    const streamResponded = codecProbe.codec !== null
    checks.push(
      checkResult(
        "authentication",
        streamResponded,
        streamResponded
          ? "NVR accepted RTSP credentials."
          : "RTSP authentication could not be verified because the stream returned no video metadata.",
        streamResponded ? undefined : "authentication_unverified",
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

    checks.push(
      checkResult(
        "codec",
        codecProbe.compatible,
        codecProbe.compatible
          ? `Codec ${codecProbe.codec ?? "h264"} is compatible.`
          : "Unsupported codec — PlayTT requires H.264 for v1 capture.",
        codecProbe.compatible ? undefined : "codec_incompatible",
      ),
    )

    const skewMs = parseClockSkewMs(combined)
    if (skewMs === null) {
      checks.push(
        checkResult(
          "clock_skew",
          false,
          "Clock skew could not be measured — enable stream timestamps and verify NTP on the NVR.",
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

    const passed = checks.every((entry) => entry.passed)
    return { passed, timeMode, checks }
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
