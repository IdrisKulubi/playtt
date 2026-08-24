/** When true, stats and replays use mock modules until live APIs ship. */
export const USE_MOCK_PLAYER_DATA = true

/** When true, Activity highlights load from /api/replays/mine instead of mock replays. */
export const USE_LIVE_REPLAY_LIBRARY =
  process.env.EXPO_PUBLIC_LIVE_REPLAY_LIBRARY !== "false"

export const MOCK_PREVIEW_LABEL = "Preview"
export const MOCK_SAMPLE_LABEL = "Sample"
