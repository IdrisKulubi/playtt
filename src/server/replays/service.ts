import {
  getPaymentReturnUrl,
  getProductPaymentCallbackUrl,
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import {
  initializeHostedTransaction,
  PaystackApiError,
} from "@/server/payments/paystack-client"
import { PaymentServiceError } from "@/server/payments/errors"
import {
  REPLAY_CLIP_DURATION_SECONDS,
  REPLAY_PACK_CREDITS,
  REPLAY_PACK_PRICE_KES,
} from "@/server/replays/constants"
import { ReplayServiceError } from "@/server/replays/errors"
import {
  debitReplayCredit,
  getActiveBookingForReplay,
  getLastPackPurchaseAt,
  getOrCreateCreditBalance,
  getUserEmail,
  insertProductPayment,
  listReplaysForUser,
} from "@/server/replays/repository"
import { enqueueCoachAnalysis } from "@/server/coach/analysis"
import { enqueueNvrClip } from "@/server/replays/nvr-worker"

function metadataTitle(metadata: Record<string, unknown> | null | undefined) {
  const title = metadata?.title
  return typeof title === "string" && title.trim() ? title : "Session clip"
}

export async function getReplayCreditsStatus(userId: string) {
  const [balance, lastPurchasedAt] = await Promise.all([
    getOrCreateCreditBalance(userId),
    getLastPackPurchaseAt(userId),
  ])

  return {
    balance: balance.balance,
    packCredits: REPLAY_PACK_CREDITS,
    packPriceKes: REPLAY_PACK_PRICE_KES,
    lastPurchasedAt: lastPurchasedAt?.toISOString() ?? null,
  }
}

export async function initiateReplayPackPurchase(userId: string) {
  const email = await getUserEmail(userId)

  if (!email) {
    throw new ReplayServiceError(
      "USER_NOT_FOUND",
      "We could not find your account email.",
      404,
    )
  }

  let initialized

  try {
    initialized = await initializeHostedTransaction({
      email,
      amount: kesToPaystackAmount(REPLAY_PACK_PRICE_KES),
      currency: PAYSTACK_CURRENCY,
      callbackUrl: getProductPaymentCallbackUrl("replay_pack"),
      metadata: {
        paymentType: "replay_pack",
        userId,
      },
    })
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Could not start payment."

    throw new PaymentServiceError("PAYMENT_INIT_FAILED", message, 502)
  }

  await insertProductPayment({
    userId,
    productType: "replay_pack",
    providerReference: initialized.reference,
    amount: String(REPLAY_PACK_PRICE_KES),
    currency: PAYSTACK_CURRENCY,
    rawPayload: initialized as unknown as Record<string, unknown>,
  })

  return {
    method: "hosted" as const,
    reference: initialized.reference,
    status: "pending",
    displayText: "You will be redirected to a secure checkout page.",
    authorizationUrl: initialized.authorization_url,
    returnUrl: getPaymentReturnUrl(),
  }
}

export async function requestReplayCapture(input: {
  userId: string
  bookingId: string
}) {
  const booking = await getActiveBookingForReplay({
    bookingId: input.bookingId,
    userId: input.userId,
  })

  if (!booking) {
    throw new ReplayServiceError(
      "BOOKING_NOT_ACTIVE",
      "Replay capture is only available during an active confirmed session.",
      409,
    )
  }

  const result = await debitReplayCredit({
    userId: input.userId,
    bookingId: booking.id,
    locationId: booking.locationId,
  })

  if (!result.ok) {
    throw new ReplayServiceError(
      "NO_CREDITS",
      "You need clip credits to capture a highlight. Buy a clip pack in the app.",
      402,
    )
  }

  await enqueueNvrClip({
    replayId: result.replay.id,
    bookingId: booking.id,
    locationId: booking.locationId,
    userId: input.userId,
    durationSeconds: REPLAY_CLIP_DURATION_SECONDS,
  })

  return {
    replayId: result.replay.id,
    status: result.replay.status,
    remainingCredits: result.remainingCredits,
    podMessage: "Clipping your highlight…",
  }
}

export async function listUserReplays(userId: string) {
  const rows = await listReplaysForUser(userId)

  return rows.map((row) => ({
    id: row.id,
    title: metadataTitle(row.title as Record<string, unknown> | null),
    recordedAt: (row.readyAt ?? row.requestedAt).toISOString(),
    durationSeconds: REPLAY_CLIP_DURATION_SECONDS,
    locationName: row.locationName,
    status: row.status,
    videoUrl: row.videoUrl,
    bookingId: row.bookingId,
  }))
}

export async function markReplayReady(input: {
  replayId: string
  videoUrl: string
  title?: string
}) {
  const { markReplayReadyInDb } = await import("@/server/replays/nvr-worker")
  const replay = await markReplayReadyInDb(input)

  if (replay.userId) {
    await enqueueCoachAnalysis({
      replayId: replay.id,
      userId: replay.userId,
      bookingId: replay.bookingId,
    })
  }

  return replay
}
