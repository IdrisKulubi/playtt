export const REPLAY_PACK_CREDITS = 10
export const REPLAY_PACK_PRICE_KES = 1200

export type MockReplayCredits = {
  balance: number
  packCredits: number
  packPriceKes: number
  lastPurchasedAt: string | null
}

export const MOCK_REPLAY_CREDITS: MockReplayCredits = {
  balance: 7,
  packCredits: REPLAY_PACK_CREDITS,
  packPriceKes: REPLAY_PACK_PRICE_KES,
  lastPurchasedAt: "2026-05-20T14:00:00.000Z",
}
