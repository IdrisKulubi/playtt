import { fetchBookingTimelineRawData } from "@/server/operations/timeline-repository"
import {
  buildConfirmationCorrelationId,
  mergeTimelineEvents,
  normalizeAuditEvents,
  normalizeBookingEvents,
  normalizeDeviceCommandEvents,
  normalizeMediaEvents,
  normalizeOutboxEvents,
  normalizePaymentEvents,
  normalizePlaySessionEvents,
  normalizeReplayEvents,
  normalizeSessionEventRows,
  type BookingTimeline,
} from "@/server/operations/timeline-types"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function getBookingTimeline(
  context: TenantContext,
  bookingId: string,
): Promise<BookingTimeline | null> {
  authorize(context, "booking.read")

  const raw = await fetchBookingTimelineRawData(context, bookingId)

  if (!raw) {
    return null
  }

  const correlationIds = [
    buildConfirmationCorrelationId(bookingId),
    ...(raw.playSession ? [raw.playSession.correlationId] : []),
    ...raw.replayRequests.map((row) => row.correlationId),
  ]

  const events = mergeTimelineEvents(
    normalizeBookingEvents(raw.header),
    normalizePaymentEvents(
      raw.payments.map((payment) => ({
        ...payment,
        correlationId: buildConfirmationCorrelationId(bookingId),
      })),
    ),
    raw.playSession ? normalizePlaySessionEvents(raw.playSession) : [],
    normalizeOutboxEvents(raw.outboxEvents),
    normalizeReplayEvents(raw.replayRequests),
    normalizeDeviceCommandEvents(raw.deviceCommands),
    normalizeMediaEvents(raw.mediaAssets),
    normalizeSessionEventRows(raw.sessionEvents),
    normalizeAuditEvents(raw.auditLogs),
  )

  return {
    summary: {
      ...raw.header,
      playSessionId: raw.playSession?.id ?? null,
      playSessionStatus: raw.playSession?.status ?? null,
      correlationIds: [...new Set(correlationIds)],
    },
    events,
    accessConfigured: raw.sessionEvents.length > 0,
  }
}
