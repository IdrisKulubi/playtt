/**
 * The TV polls the replay status while a capture runs. When a replay has just
 * become ready, the status response can carry its playback link so the TV
 * starts the clip right away instead of making a second request for it.
 */

/** Only replays this recent are offered to the TV (matches the TV's window). */
export const DISPLAY_PLAYBACK_HINT_WINDOW_MS = 60_000

export function shouldAttachDisplayPlayback(input: {
  latestReplay: {
    replayId: string | null
    status: string
    readyAt: string | null
  } | null
  /** The replay the TV already played; never re-offer it. */
  seenReplayId: string | null
  nowMs: number
}): input is typeof input & {
  latestReplay: { replayId: string; status: "ready"; readyAt: string }
} {
  const latest = input.latestReplay
  if (!latest || latest.status !== "ready" || !latest.replayId || !latest.readyAt) {
    return false
  }

  if (input.seenReplayId && latest.replayId === input.seenReplayId) {
    return false
  }

  const readyAtMs = Date.parse(latest.readyAt)
  return (
    Number.isFinite(readyAtMs) &&
    input.nowMs - readyAtMs <= DISPLAY_PLAYBACK_HINT_WINDOW_MS
  )
}
