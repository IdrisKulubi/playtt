export const COACH_MONTHLY_PRICE_KES = 2499

export type MockCoachInsight = {
  id: string
  replayId: string
  replayTitle: string
  summary: string
  focusAreas: string[]
  createdAt: string
}

export type MockCoachTrainingItem = {
  id: string
  insightId: string | null
  title: string
  description: string
  durationMinutes: number | null
  completedAt: string | null
}

export type MockCoachStatus = {
  isActive: boolean
  planLabel: string
  monthlyPriceKes: number
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export const MOCK_COACH_STATUS: MockCoachStatus = {
  isActive: true,
  planLabel: "Coach",
  monthlyPriceKes: COACH_MONTHLY_PRICE_KES,
  currentPeriodEnd: "2026-07-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
}

export const MOCK_COACH_INSIGHTS: MockCoachInsight[] = [
  {
    id: "insight-1",
    replayId: "replay-1",
    replayTitle: "Smash rally",
    summary:
      "Your forehand attack is strong when you step in early. On the third ball, you rushed the recovery — stay balanced before the next swing.",
    focusAreas: ["Footwork", "Forehand recovery"],
    createdAt: "2026-05-28T19:15:00.000Z",
  },
  {
    id: "insight-2",
    replayId: "replay-2",
    replayTitle: "Match point",
    summary:
      "Serve placement to the elbow created openings. Practice varying spin on your second serve to keep opponents guessing.",
    focusAreas: ["Serve placement", "Second serve"],
    createdAt: "2026-05-21T19:45:00.000Z",
  },
]

export const MOCK_COACH_TRAINING: MockCoachTrainingItem[] = [
  {
    id: "train-1",
    insightId: "insight-1",
    title: "Split-step recovery drill",
    description:
      "After each forehand, reset with a small split-step before the next ball. 5 minutes, slow feeds.",
    durationMinutes: 5,
    completedAt: null,
  },
  {
    id: "train-2",
    insightId: "insight-1",
    title: "Cross-court rally block",
    description:
      "Keep 10 consecutive forehands cross-court without moving off the table edge.",
    durationMinutes: 10,
    completedAt: null,
  },
  {
    id: "train-3",
    insightId: "insight-2",
    title: "Second serve variation",
    description:
      "Alternate backspin and no-spin serves to the opponent's elbow for one service game.",
    durationMinutes: 8,
    completedAt: "2026-05-22T10:00:00.000Z",
  },
]
