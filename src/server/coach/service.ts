import {
  getProductPaymentCallbackUrl,
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import {
  initializeHostedTransaction,
  PaystackApiError,
} from "@/server/payments/paystack-client"
import { PaymentServiceError } from "@/server/payments/errors"
import { COACH_MONTHLY_PRICE_KES, COACH_PLAN_ID } from "@/server/coach/constants"
import { CoachServiceError } from "@/server/coach/errors"
import {
  cancelCoachAtPeriodEnd,
  getCoachInsightById,
  getCoachSubscription,
  isCoachActive,
  listCoachInsights,
  listCoachTraining,
} from "@/server/coach/repository"
import { insertProductPayment, getUserEmail } from "@/server/replays/repository"

function metadataTitle(metadata: Record<string, unknown> | null | undefined) {
  const title = metadata?.title
  return typeof title === "string" && title.trim() ? title : "Session clip"
}

export async function getCoachStatus(userId: string) {
  const subscription = await getCoachSubscription(userId)
  const active = await isCoachActive(userId)

  return {
    isActive: active,
    planLabel: "Coach",
    monthlyPriceKes: COACH_MONTHLY_PRICE_KES,
    currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    planId: subscription?.planId ?? COACH_PLAN_ID,
  }
}

export async function initiateCoachSubscribe(userId: string) {
  const email = await getUserEmail(userId)

  if (!email) {
    throw new CoachServiceError(
      "USER_NOT_FOUND",
      "We could not find your account email.",
      404,
    )
  }

  let initialized

  try {
    initialized = await initializeHostedTransaction({
      email,
      amount: kesToPaystackAmount(COACH_MONTHLY_PRICE_KES),
      currency: PAYSTACK_CURRENCY,
      callbackUrl: getProductPaymentCallbackUrl("coach_subscription"),
      metadata: {
        paymentType: "coach_subscription",
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
    productType: "coach_subscription",
    providerReference: initialized.reference,
    amount: String(COACH_MONTHLY_PRICE_KES),
    currency: PAYSTACK_CURRENCY,
    rawPayload: initialized as unknown as Record<string, unknown>,
  })

  return {
    method: "hosted" as const,
    reference: initialized.reference,
    status: "pending",
    displayText: "You will be redirected to a secure checkout page.",
    authorizationUrl: initialized.authorization_url,
    returnUrl: getProductPaymentCallbackUrl("coach_subscription"),
  }
}

export async function cancelCoachSubscription(userId: string) {
  const row = await cancelCoachAtPeriodEnd(userId)

  if (!row) {
    throw new CoachServiceError(
      "NO_SUBSCRIPTION",
      "You do not have an active Coach subscription.",
      404,
    )
  }

  return {
    cancelAtPeriodEnd: true,
    currentPeriodEnd: row.currentPeriodEnd.toISOString(),
  }
}

export async function getCoachInsightsForUser(userId: string) {
  const rows = await listCoachInsights(userId)

  return rows.map((row) => ({
    id: row.id,
    replayId: row.replayId,
    replayTitle: metadataTitle(row.replayTitle as Record<string, unknown> | null),
    summary: row.summary,
    focusAreas: row.focusAreas,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getCoachInsightDetail(input: {
  userId: string
  insightId: string
}) {
  const result = await getCoachInsightById(input)

  if (!result) {
    throw new CoachServiceError(
      "INSIGHT_NOT_FOUND",
      "We could not find that insight.",
      404,
    )
  }

  return {
    insight: {
      id: result.insight.id,
      replayId: result.insight.replayId,
      replayTitle: metadataTitle(
        result.insight.replayTitle as Record<string, unknown> | null,
      ),
      summary: result.insight.summary,
      focusAreas: result.insight.focusAreas,
      createdAt: result.insight.createdAt.toISOString(),
    },
    training: result.training.map((item) => ({
      id: item.id,
      insightId: item.insightId,
      title: item.title,
      description: item.description,
      durationMinutes: item.durationMinutes,
      completedAt: item.completedAt?.toISOString() ?? null,
    })),
  }
}

export async function getCoachTrainingForUser(userId: string) {
  const rows = await listCoachTraining(userId)

  return rows.map((item) => ({
    id: item.id,
    insightId: item.insightId,
    title: item.title,
    description: item.description,
    durationMinutes: item.durationMinutes,
    completedAt: item.completedAt?.toISOString() ?? null,
  }))
}
