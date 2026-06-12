import { isCoachActive, insertCoachInsight } from "@/server/coach/repository"
import { completeStubNvrClip } from "@/server/replays/nvr-worker"

type CoachAnalysisInput = {
  replayId: string
  userId: string
  bookingId: string
}

/** Generate coach insight from a ready replay. MVP uses deterministic copy. */
export async function runCoachAnalysis(input: CoachAnalysisInput) {
  const active = await isCoachActive(input.userId)

  if (!active) {
    return { skipped: true, reason: "no_subscription" as const }
  }

  const insight = await insertCoachInsight({
    userId: input.userId,
    replayId: input.replayId,
    bookingId: input.bookingId,
    summary:
      "Your rally tempo is improving. Focus on staying balanced after your forehand attack so you can recover for the next ball.",
    focusAreas: ["Footwork", "Forehand recovery"],
    trainingItems: [
      {
        title: "Split-step recovery drill",
        description:
          "After each forehand, reset with a small split-step before the next ball. 5 minutes, slow feeds.",
        durationMinutes: 5,
        sortOrder: 0,
      },
      {
        title: "Cross-court rally block",
        description:
          "Keep 10 consecutive forehands cross-court without moving off the table edge.",
        durationMinutes: 10,
        sortOrder: 1,
      },
    ],
  })

  return { skipped: false, insightId: insight?.id ?? null }
}

/** Queue coach analysis after replay is ready. */
export async function enqueueCoachAnalysis(input: CoachAnalysisInput) {
  return runCoachAnalysis(input)
}

/** Dev pipeline: finish stub NVR clip then run coach analysis. */
export async function processReplayPipeline(replayId: string) {
  const replay = await completeStubNvrClip(replayId)

  if (!replay.userId) {
    return { replay, coach: { skipped: true, reason: "no_user" as const } }
  }

  const coach = await enqueueCoachAnalysis({
    replayId: replay.id,
    userId: replay.userId,
    bookingId: replay.bookingId,
  })

  return { replay, coach }
}
