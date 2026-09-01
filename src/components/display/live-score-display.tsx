"use client"

import { LiveScoreBoard } from "@/components/display/live-score-board"
import { useLiveScore } from "@/components/display/use-live-score"

export function LiveScoreDisplay({
  resourceId,
  variant,
}: {
  resourceId: string
  variant: "kiosk" | "tv"
}) {
  const {
    payload,
    isLoading,
    error,
    replayOverlay,
    dismissReplayOverlay,
  } = useLiveScore(resourceId)

  if (isLoading && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
        Loading live score…
      </div>
    )
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Unable to load scoreboard</h1>
          <p className="mt-3 text-white/60">{error}</p>
        </div>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
        Scoreboard unavailable.
      </div>
    )
  }

  return (
    <>
      <LiveScoreBoard payload={payload} variant={variant} />
      {replayOverlay ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <video
            key={replayOverlay.playbackUrl}
            className="max-h-[80vh] w-full max-w-5xl rounded-2xl bg-black shadow-2xl"
            autoPlay
            muted
            playsInline
            src={replayOverlay.playbackUrl}
            onEnded={dismissReplayOverlay}
          />
        </div>
      ) : null}
    </>
  )
}
