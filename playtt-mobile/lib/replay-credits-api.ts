import { apiFetch } from "@/lib/api-client"
import type { PurchaseInitResult, ReplayCreditsStatus } from "@/lib/coach-types"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import { MOCK_REPLAY_CREDITS } from "@/lib/mock/mock-replay-credits"

type CreditsResponse = { data?: { credits: ReplayCreditsStatus } }
type PurchaseResponse = { data?: PurchaseInitResult }

export async function fetchReplayCredits(): Promise<ReplayCreditsStatus> {
  if (USE_MOCK_PLAYER_DATA) {
    return MOCK_REPLAY_CREDITS
  }

  const response = await apiFetch<CreditsResponse>("/api/replays/credits")
  return (
    response.data?.credits ?? {
      balance: 0,
      packCredits: 10,
      packPriceKes: 0,
      lastPurchasedAt: null,
    }
  )
}

export async function initiateReplayPackPurchase(): Promise<PurchaseInitResult> {
  const response = await apiFetch<PurchaseResponse>(
    "/api/replays/credits/purchase",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  )

  if (!response.data) {
    throw new Error("Replay pack purchase response was empty.")
  }

  return response.data
}
