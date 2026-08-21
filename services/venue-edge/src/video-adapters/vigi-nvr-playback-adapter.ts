import type {
  VideoAdapter,
  VideoExtractionRequest,
  VideoExtractionResult,
} from "./types"

const BLOCKED_IN_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER !== "true"

/**
 * Model-tested stub for VIGI NVR playback fallback.
 * Blocked in production until pilot hardware validation completes.
 */
export class VigiNvrPlaybackAdapter implements VideoAdapter {
  readonly name = "vigi-nvr-playback"

  constructor(private readonly model?: string) {}

  async isAvailable(): Promise<boolean> {
    if (BLOCKED_IN_PRODUCTION) {
      return false
    }

    return Boolean(this.model)
  }

  async extractClip(
    request: VideoExtractionRequest,
  ): Promise<VideoExtractionResult> {
    if (BLOCKED_IN_PRODUCTION) {
      throw new Error(
        "VIGI NVR playback adapter is blocked in production until pilot validation.",
      )
    }

    throw new Error(
      `VIGI NVR playback adapter is a stub for model ${this.model ?? "unknown"}.`,
    )
  }
}

export function isVigiAdapterBlockedInProduction(): boolean {
  return BLOCKED_IN_PRODUCTION
}
