"use client"

import { useEffect, useState } from "react"

import { TvScoreboardScene } from "@/components/display/tv-scoreboard"
import {
  TvIdleScene,
  TvSessionScene,
  TvUpNextScene,
  useNow,
} from "@/components/display/tv-scenes"
import {
  useLiveScore,
  type DisplaySnapshotPayload,
} from "@/components/display/use-live-score"
import { defaultTheme } from "@/lib/display-themes"
import { hasMatch } from "@/server/scoring/match-setup"

/**
 * How long a downloaded venue-PC clip gets to start playing before the TV
 * gives up on it and waits for the R2 copy.
 */
const LOCAL_CLIP_START_TIMEOUT_MS = 5_000
/** Minutes before a booking when the TV switches to "Up next". */
const UP_NEXT_LEAD_MS = 5 * 60 * 1000
/** How long the match-won card stays up before the session scene returns. */
const END_CARD_MS = 90 * 1000

/**
 * Venue TV. One screen per table, so it picks its own scene from state:
 * replay (on top of everything) → scoreboard while a match is on →
 * the booker's session → up next (5 minutes before) → idle.
 */
export function VenueTvDisplay({ resourceId }: { resourceId: string }) {
  const {
    payload,
    isLoading,
    error,
    replayOverlay,
    dismissReplayOverlay,
    handleReplayError,
  } = useLiveScore(resourceId)

  // A venue-PC clip that won't start must not leave the TV on black: give it
  // a few seconds, then fall back to the R2 copy.
  const playbackUrl = replayOverlay?.playbackUrl
  const isLocal = replayOverlay?.isLocal ?? false
  const [startedUrl, setStartedUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!playbackUrl || !isLocal || startedUrl === playbackUrl) {
      return
    }
    const timer = setTimeout(handleReplayError, LOCAL_CLIP_START_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [handleReplayError, isLocal, playbackUrl, startedUrl])

  if (!payload) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050505] px-6 text-center text-white/60">
        {isLoading ? "Loading…" : (error ?? "This screen is unavailable.")}
      </div>
    )
  }

  return (
    <>
      <TvBoard payload={payload} />
      {/* onError: a clip that can't play must not leave the TV stuck on black. */}
      {replayOverlay ? (
        <div className="tv-fade fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-[4vw]">
          <p className="mb-[2.4vh] self-start font-mono text-[1.7vh] tracking-[0.28em] text-white/70 uppercase">
            Replay · {payload.resource.name}
          </p>
          <video
            key={replayOverlay.playbackUrl}
            className="max-h-[82vh] w-full rounded-[1.6vh] bg-black object-contain"
            autoPlay
            muted
            playsInline
            src={replayOverlay.playbackUrl}
            onEnded={dismissReplayOverlay}
            onError={handleReplayError}
            // Started: cancels the "can't reach the venue PC" timeout.
            onLoadedData={() => setStartedUrl(replayOverlay.playbackUrl)}
          />
        </div>
      ) : null}
    </>
  )
}

function TvBoard({ payload }: { payload: DisplaySnapshotPayload }) {
  const now = useNow()
  const state = payload.snapshot?.state
  const schedule = payload.schedule
  const tableName = payload.resource.name
  const venue = schedule?.venueName ?? "PlayTT"
  const theme = payload.theme ?? defaultTheme()

  if (payload.status === "active" && state && hasMatch(state)) {
    const finishedAt = payload.snapshot ? new Date(payload.snapshot.updatedAt).getTime() : now
    const endCardOver = state.matchStatus === "completed" && now - finishedAt > END_CARD_MS
    if (!endCardOver) {
      return <TvScoreboardScene tableName={tableName} state={state} theme={theme} />
    }
  }

  // The server picks current/next at fetch time; re-check against the clock so
  // the scene flips on the exact second between 5-second refreshes.
  const candidates = [schedule?.current, schedule?.next].filter(
    (booking): booking is NonNullable<typeof booking> => Boolean(booking),
  )
  const current = candidates.find(
    (booking) =>
      new Date(booking.startsAt).getTime() <= now &&
      new Date(booking.endsAt).getTime() > now,
  )
  const upcoming = candidates.find(
    (booking) => new Date(booking.startsAt).getTime() > now,
  )

  if (current) {
    return <TvSessionScene key={current.bookingId} theme={theme} tableName={tableName} venue={venue} booking={current} />
  }

  if (payload.status === "active" && payload.playSession) {
    // Session started on the hardware without a matching booking on screen.
    return (
      <TvSessionScene
        key={payload.playSession.id}
        theme={theme}
        tableName={tableName}
        venue={venue}
        booking={{
          bookingId: payload.playSession.bookingId,
          firstName: "Game on",
          groupSize: 2,
          startsAt: payload.playSession.scheduledStartAt,
          endsAt: payload.playSession.scheduledEndAt,
        }}
      />
    )
  }

  if (upcoming && new Date(upcoming.startsAt).getTime() - now <= UP_NEXT_LEAD_MS) {
    return <TvUpNextScene key={`next-${upcoming.bookingId}`} theme={theme} tableName={tableName} venue={venue} booking={upcoming} />
  }

  return <TvIdleScene theme={theme} tableName={tableName} venue={venue} next={upcoming ?? null} />
}
