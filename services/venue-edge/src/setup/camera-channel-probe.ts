import { probeCodec } from "../ffmpeg/probe"
import type { LocalCameraCodec } from "../local-storage/local-camera-types"

export interface CameraChannelProbeResult {
  live: boolean
  codec: LocalCameraCodec
}

export interface CameraChannelProbeInput {
  liveRtspUrl: string
}

export interface CameraChannelProbeRunner {
  probe(input: CameraChannelProbeInput): Promise<CameraChannelProbeResult>
}

function authFailed(stderr: string): boolean {
  return /401|403|unauthorized|authentication failed|access denied/i.test(stderr)
}

function mapCodec(value: string | null | undefined): LocalCameraCodec {
  if (value === "h264") {
    return "h264"
  }
  if (value === "h265") {
    return "h265"
  }
  return "unknown"
}

export class DefaultCameraChannelProbeRunner implements CameraChannelProbeRunner {
  async probe(input: CameraChannelProbeInput): Promise<CameraChannelProbeResult> {
    const codecProbe = await probeCodec(input.liveRtspUrl)
    const combined = codecProbe.raw

    if (authFailed(combined) || combined.length === 0) {
      return { live: false, codec: "unknown" }
    }

    return {
      live: true,
      codec: mapCodec(codecProbe.codec),
    }
  }
}
