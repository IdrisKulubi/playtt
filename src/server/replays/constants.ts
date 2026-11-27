export const REPLAY_PACK_CREDITS = 10
export const REPLAY_PACK_PRICE_KES = 1200
/**
 * Default clip length. Admins can change it per tenant (Admin → Replay clips);
 * see `clip-settings.ts`. Each request stores its own pre/post-roll, so this
 * is only the fallback for new requests and for old rows without metadata.
 */
export const REPLAY_CLIP_DURATION_SECONDS = 40
/** Seconds kept after the tap. Every second here is a second the TV waits. */
export const REPLAY_POST_ROLL_SECONDS = 3
export const REPLAY_PRE_ROLL_SECONDS =
  REPLAY_CLIP_DURATION_SECONDS - REPLAY_POST_ROLL_SECONDS
/**
 * Admin-selectable bounds. The upper bound stays well inside the VenueEdge
 * rolling buffer (120 s retention) so the start of a clip is always on disk.
 */
export const MIN_REPLAY_CLIP_SECONDS = 10
export const MAX_REPLAY_CLIP_SECONDS = 60

export const OPERATOR_RETRYABLE_REPLAY_REQUEST_STATUSES = [
  "edge_offline",
  "buffer_missing",
  "extraction_failed",
  "upload_failed",
] as const

export const OPERATOR_CANCELABLE_REPLAY_REQUEST_STATUSES = [
  "requested",
  "authorized",
  "dispatched",
  "edge_acknowledged",
  "capturing",
  "extracting",
  "uploading",
  "verifying",
  "edge_offline",
  "buffer_missing",
  "extraction_failed",
  "upload_failed",
] as const

/** Length of clips recorded before the length became configurable. */
export const LEGACY_REPLAY_CLIP_SECONDS = 15

/** A replay's real length, from the metadata stamped when it was requested. */
export function replayDurationSeconds(metadata: unknown): number {
  const value = (metadata as { clipDurationSeconds?: unknown } | null | undefined)
    ?.clipDurationSeconds
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : LEGACY_REPLAY_CLIP_SECONDS
}

export function isValidClipDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_REPLAY_CLIP_SECONDS &&
    value <= MAX_REPLAY_CLIP_SECONDS
  )
}

/** Bad or missing stored values fall back to the default, never break capture. */
export function clipWindowFor(clipDurationSeconds: unknown) {
  const duration = isValidClipDuration(clipDurationSeconds)
    ? clipDurationSeconds
    : REPLAY_CLIP_DURATION_SECONDS
  return {
    clipDurationSeconds: duration,
    preRollSeconds: duration - REPLAY_POST_ROLL_SECONDS,
    postRollSeconds: REPLAY_POST_ROLL_SECONDS,
  }
}
