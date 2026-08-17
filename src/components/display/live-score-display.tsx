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
  const { payload, isLoading, error } = useLiveScore(resourceId)

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

  return <LiveScoreBoard payload={payload} variant={variant} />
}
