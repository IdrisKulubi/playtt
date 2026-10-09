/** Home, Coach, and Community previews; Activity stats and clips have separate live flags. */
export const USE_MOCK_PLAYER_DATA = true

/** When true, Activity highlights load from /api/replays/mine instead of mock replays. */
export const USE_LIVE_REPLAY_LIBRARY =
  process.env.EXPO_PUBLIC_LIVE_REPLAY_LIBRARY !== "false"

/** Activity highlights + clip balance (does not change Coach/Community mock defaults). */
export const USE_LIVE_ACTIVITY_CLIPS = USE_LIVE_REPLAY_LIBRARY

export const MOCK_PREVIEW_LABEL = "Preview"
export const MOCK_SAMPLE_LABEL = "Sample"

/** Set false only for an explicitly labelled offline stats demo. */
export const USE_LIVE_PLAYER_STATS =
  process.env.EXPO_PUBLIC_LIVE_PLAYER_STATS !== "false"
