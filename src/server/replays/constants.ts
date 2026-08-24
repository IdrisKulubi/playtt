export const REPLAY_PACK_CREDITS = 10
export const REPLAY_PACK_PRICE_KES = 1200
export const REPLAY_CLIP_DURATION_SECONDS = 15
export const REPLAY_PRE_ROLL_SECONDS = 12
export const REPLAY_POST_ROLL_SECONDS = 3

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
