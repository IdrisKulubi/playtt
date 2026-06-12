import { apiFetch } from "@/lib/api-client"
import type {
  CoachInsight,
  CoachStatus,
  CoachTrainingItem,
  PurchaseInitResult,
} from "@/lib/coach-types"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import {
  MOCK_COACH_INSIGHTS,
  MOCK_COACH_STATUS,
  MOCK_COACH_TRAINING,
} from "@/lib/mock/mock-coach"

type CoachStatusResponse = { data?: { status: CoachStatus } }
type CoachInsightsResponse = { data?: { insights: CoachInsight[] } }
type CoachInsightResponse = { data?: { insight: CoachInsight; training: CoachTrainingItem[] } }
type CoachTrainingResponse = { data?: { items: CoachTrainingItem[] } }
type SubscribeResponse = { data?: PurchaseInitResult }

export async function fetchCoachStatus(): Promise<CoachStatus> {
  if (USE_MOCK_PLAYER_DATA) {
    return MOCK_COACH_STATUS
  }

  const response = await apiFetch<CoachStatusResponse>("/api/coach/status")
  return (
    response.data?.status ?? {
      isActive: false,
      planLabel: "Coach",
      monthlyPriceKes: 0,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
  )
}

export async function fetchCoachInsights(): Promise<CoachInsight[]> {
  if (USE_MOCK_PLAYER_DATA) {
    return MOCK_COACH_INSIGHTS
  }

  const response = await apiFetch<CoachInsightsResponse>("/api/coach/insights")
  return response.data?.insights ?? []
}

export async function fetchCoachInsightById(
  insightId: string,
): Promise<{ insight: CoachInsight; training: CoachTrainingItem[] } | null> {
  if (USE_MOCK_PLAYER_DATA) {
    const insight = MOCK_COACH_INSIGHTS.find((item) => item.id === insightId)
    if (!insight) return null
    return {
      insight,
      training: MOCK_COACH_TRAINING.filter((item) => item.insightId === insightId),
    }
  }

  const response = await apiFetch<CoachInsightResponse>(
    `/api/coach/insights/${insightId}`,
  )
  if (!response.data?.insight) return null
  return {
    insight: response.data.insight,
    training: response.data.training ?? [],
  }
}

export async function fetchCoachTraining(): Promise<CoachTrainingItem[]> {
  if (USE_MOCK_PLAYER_DATA) {
    return MOCK_COACH_TRAINING
  }

  const response = await apiFetch<CoachTrainingResponse>("/api/coach/training")
  return response.data?.items ?? []
}

export async function initiateCoachSubscribe(): Promise<PurchaseInitResult> {
  const response = await apiFetch<SubscribeResponse>("/api/coach/subscribe", {
    method: "POST",
    body: JSON.stringify({}),
  })

  if (!response.data) {
    throw new Error("Coach subscription response was empty.")
  }

  return response.data
}

export async function cancelCoachSubscription() {
  await apiFetch("/api/coach/cancel", {
    method: "POST",
    body: JSON.stringify({}),
  })
}
