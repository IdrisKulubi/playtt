export type CoachSegment = "chat" | "insights" | "training"

export type CoachStatus = {
  isActive: boolean
  planLabel: string
  monthlyPriceKes: number
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export type CoachInsight = {
  id: string
  replayId: string
  replayTitle: string
  summary: string
  focusAreas: string[]
  createdAt: string
}

export type CoachTrainingItem = {
  id: string
  insightId: string | null
  title: string
  description: string
  durationMinutes: number | null
  completedAt: string | null
}

export type ReplayCreditsStatus = {
  balance: number
  packCredits: number
  packPriceKes: number
  lastPurchasedAt: string | null
}

export type PurchaseInitResult = {
  method: "hosted"
  reference: string
  status: string
  displayText: string
  authorizationUrl?: string
  returnUrl: string
}
