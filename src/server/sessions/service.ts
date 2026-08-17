import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import { PlaySessionError } from "@/server/sessions/errors"
import {
  ensurePlaySessionForBooking,
  getPlaySessionByBookingId,
  transitionPlaySession,
  type EnsurePlaySessionBookingInput,
  type PlaySessionRecord,
  type PlaySessionStatus,
} from "@/server/sessions/play-sessions"
import type { TenantContext } from "@/server/tenancy/types"

export type {
  EnsurePlaySessionBookingInput,
  PlaySessionRecord,
  PlaySessionStatus,
}

export async function getPlaySessionForBooking(
  context: TenantContext,
  bookingId: string,
): Promise<PlaySessionRecord | null> {
  authorize(context, "booking.read")
  return getPlaySessionByBookingId(context, bookingId)
}

export async function ensurePlaySessionForConfirmedBooking(
  context: TenantContext,
  booking: EnsurePlaySessionBookingInput,
): Promise<PlaySessionRecord | null> {
  return ensurePlaySessionForBooking(context, booking)
}

export async function transitionPlaySessionWithAudit(
  context: TenantContext,
  sessionId: string,
  toStatus: PlaySessionStatus,
  cause: string,
): Promise<PlaySessionRecord> {
  try {
    const updated = await transitionPlaySession(
      context,
      sessionId,
      toStatus,
      cause,
    )

    await writeAuditLog(context, {
      action: "play_session.transition",
      targetType: "play_session",
      targetId: sessionId,
      metadata: {
        toStatus,
        cause,
      },
    })

    return updated
  } catch (error) {
    if (
      error instanceof PlaySessionError &&
      error.code === "ILLEGAL_SESSION_TRANSITION"
    ) {
      await writeAuditLog(context, {
        action: "play_session.transition.rejected",
        targetType: "play_session",
        targetId: sessionId,
        metadata: {
          toStatus,
          cause,
          code: error.code,
          message: error.message,
        },
      })
    }

    throw error
  }
}
