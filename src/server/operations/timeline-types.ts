export type TimelineCategory =
  | "payment"
  | "booking"
  | "session"
  | "worker"
  | "device"
  | "replay"
  | "media"
  | "access"
  | "audit"

export interface TimelineEvent {
  id: string
  category: TimelineCategory
  label: string
  status?: string
  occurredAt: string
  correlationId?: string
  entityType: string
  entityId: string
  detail?: string
}

export interface BookingTimelineSummary {
  id: string
  locationId: string
  locationName: string
  resourceId: string
  resourceName: string
  userId: string
  userName: string
  userEmail: string
  status: string
  paymentStatus: string
  startTime: string
  endTime: string
  totalAmount: string
  currency: string
  confirmedAt: string | null
  createdAt: string
  playSessionId: string | null
  playSessionStatus: string | null
  correlationIds: string[]
}

export interface BookingTimeline {
  summary: BookingTimelineSummary
  events: TimelineEvent[]
  accessConfigured: boolean
}

export function buildConfirmationCorrelationId(bookingId: string) {
  return `confirm-booking:${bookingId}`
}

function pushTimestampEvent(
  events: TimelineEvent[],
  input: {
    id: string
    category: TimelineCategory
    label: string
    status?: string
    occurredAt: string | null | undefined
    correlationId?: string
    entityType: string
    entityId: string
    detail?: string
  },
) {
  if (!input.occurredAt) {
    return
  }

  events.push({
    id: input.id,
    category: input.category,
    label: input.label,
    status: input.status,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    entityType: input.entityType,
    entityId: input.entityId,
    detail: input.detail,
  })
}

export function normalizeBookingEvents(summary: {
  id: string
  status: string
  paymentStatus: string
  createdAt: string
  confirmedAt: string | null
}): TimelineEvent[] {
  const events: TimelineEvent[] = []

  pushTimestampEvent(events, {
    id: `booking:${summary.id}:created`,
    category: "booking",
    label: "Booking created",
    status: summary.status,
    occurredAt: summary.createdAt,
    entityType: "booking",
    entityId: summary.id,
    detail: `Payment status: ${summary.paymentStatus}`,
  })

  pushTimestampEvent(events, {
    id: `booking:${summary.id}:confirmed`,
    category: "booking",
    label: "Booking confirmed",
    status: summary.status,
    occurredAt: summary.confirmedAt,
    entityType: "booking",
    entityId: summary.id,
  })

  return events
}

export function normalizePaymentEvents(
  payments: Array<{
    id: string
    status: string
    providerReference: string
    createdAt: string
    paidAt: string | null
    correlationId?: string
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const payment of payments) {
    pushTimestampEvent(events, {
      id: `payment:${payment.id}:created`,
      category: "payment",
      label: "Payment initialized",
      status: payment.status,
      occurredAt: payment.createdAt,
      correlationId: payment.correlationId,
      entityType: "payment",
      entityId: payment.id,
      detail: payment.providerReference,
    })

    pushTimestampEvent(events, {
      id: `payment:${payment.id}:paid`,
      category: "payment",
      label: "Payment confirmed",
      status: payment.status,
      occurredAt: payment.paidAt,
      correlationId: payment.correlationId,
      entityType: "payment",
      entityId: payment.id,
      detail: payment.providerReference,
    })
  }

  return events
}

export function normalizePlaySessionEvents(session: {
  id: string
  status: string
  correlationId: string
  createdAt: string
  preparedAt: string | null
  startedAt: string | null
  endedAt: string | null
  completedAt: string | null
  resetAt: string | null
}): TimelineEvent[] {
  const events: TimelineEvent[] = []

  pushTimestampEvent(events, {
    id: `play_session:${session.id}:created`,
    category: "session",
    label: "Play session created",
    status: session.status,
    occurredAt: session.createdAt,
    correlationId: session.correlationId,
    entityType: "play_session",
    entityId: session.id,
  })

  const milestones: Array<{
    key: string
    label: string
    occurredAt: string | null
  }> = [
    { key: "prepared", label: "Session prepared", occurredAt: session.preparedAt },
    { key: "started", label: "Session started", occurredAt: session.startedAt },
    { key: "ended", label: "Session ending", occurredAt: session.endedAt },
    { key: "completed", label: "Session completed", occurredAt: session.completedAt },
    { key: "reset", label: "Resource reset", occurredAt: session.resetAt },
  ]

  for (const milestone of milestones) {
    pushTimestampEvent(events, {
      id: `play_session:${session.id}:${milestone.key}`,
      category: "session",
      label: milestone.label,
      status: session.status,
      occurredAt: milestone.occurredAt,
      correlationId: session.correlationId,
      entityType: "play_session",
      entityId: session.id,
    })
  }

  return events
}

export function normalizeOutboxEvents(
  rows: Array<{
    id: string
    eventType: string
    status: string
    aggregateType: string
    aggregateId: string
    correlationId: string
    createdAt: string
    processedAt: string | null
    lastError: string | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    pushTimestampEvent(events, {
      id: `outbox:${row.id}:created`,
      category: "worker",
      label: `Outbox event queued (${row.eventType})`,
      status: row.status,
      occurredAt: row.createdAt,
      correlationId: row.correlationId,
      entityType: row.aggregateType,
      entityId: row.aggregateId,
      detail: row.lastError ?? undefined,
    })

    pushTimestampEvent(events, {
      id: `outbox:${row.id}:processed`,
      category: "worker",
      label: `Outbox event processed (${row.eventType})`,
      status: row.status,
      occurredAt: row.processedAt,
      correlationId: row.correlationId,
      entityType: row.aggregateType,
      entityId: row.aggregateId,
    })
  }

  return events
}

export function normalizeReplayEvents(
  rows: Array<{
    id: string
    status: string
    correlationId: string
    failureReason: string | null
    createdAt: string
    dispatchedAt: string | null
    edgeAcknowledgedAt: string | null
    capturingAt: string | null
    extractingAt: string | null
    uploadingAt: string | null
    verifyingAt: string | null
    readyAt: string | null
    failedAt: string | null
    expiredAt: string | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    pushTimestampEvent(events, {
      id: `replay_request:${row.id}:created`,
      category: "replay",
      label: "Replay requested",
      status: row.status,
      occurredAt: row.createdAt,
      correlationId: row.correlationId,
      entityType: "replay_request",
      entityId: row.id,
    })

    const milestones: Array<{
      key: string
      label: string
      occurredAt: string | null
    }> = [
      { key: "dispatched", label: "Replay dispatched to edge", occurredAt: row.dispatchedAt },
      {
        key: "edge_acknowledged",
        label: "Edge acknowledged replay",
        occurredAt: row.edgeAcknowledgedAt,
      },
      { key: "capturing", label: "Replay capturing", occurredAt: row.capturingAt },
      { key: "extracting", label: "Replay extracting", occurredAt: row.extractingAt },
      { key: "uploading", label: "Replay uploading", occurredAt: row.uploadingAt },
      { key: "verifying", label: "Replay verifying", occurredAt: row.verifyingAt },
      { key: "ready", label: "Replay ready", occurredAt: row.readyAt },
      {
        key: "failed",
        label: "Replay failed",
        occurredAt: row.failedAt,
      },
      { key: "expired", label: "Replay expired", occurredAt: row.expiredAt },
    ]

    for (const milestone of milestones) {
      pushTimestampEvent(events, {
        id: `replay_request:${row.id}:${milestone.key}`,
        category: "replay",
        label: milestone.label,
        status: row.status,
        occurredAt: milestone.occurredAt,
        correlationId: row.correlationId,
        entityType: "replay_request",
        entityId: row.id,
        detail:
          milestone.key === "failed"
            ? row.failureReason ?? undefined
            : undefined,
      })
    }
  }

  return events
}

export function normalizeDeviceCommandEvents(
  rows: Array<{
    id: string
    kind: string
    status: string
    correlationId: string
    createdAt: string
    deliveredAt: string | null
    acknowledgedAt: string | null
    failedAt: string | null
    lastError: string | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    pushTimestampEvent(events, {
      id: `device_command:${row.id}:created`,
      category: "device",
      label: `Device command queued (${row.kind})`,
      status: row.status,
      occurredAt: row.createdAt,
      correlationId: row.correlationId,
      entityType: "device_command",
      entityId: row.id,
    })

    pushTimestampEvent(events, {
      id: `device_command:${row.id}:delivered`,
      category: "device",
      label: `Device command delivered (${row.kind})`,
      status: row.status,
      occurredAt: row.deliveredAt,
      correlationId: row.correlationId,
      entityType: "device_command",
      entityId: row.id,
    })

    pushTimestampEvent(events, {
      id: `device_command:${row.id}:acknowledged`,
      category: "device",
      label: `Device command acknowledged (${row.kind})`,
      status: row.status,
      occurredAt: row.acknowledgedAt,
      correlationId: row.correlationId,
      entityType: "device_command",
      entityId: row.id,
    })

    pushTimestampEvent(events, {
      id: `device_command:${row.id}:failed`,
      category: "device",
      label: `Device command failed (${row.kind})`,
      status: row.status,
      occurredAt: row.failedAt,
      correlationId: row.correlationId,
      entityType: "device_command",
      entityId: row.id,
      detail: row.lastError ?? undefined,
    })
  }

  return events
}

export function normalizeMediaEvents(
  rows: Array<{
    id: string
    status: string
    createdAt: string
    uploadedAt: string | null
    readyAt: string | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    pushTimestampEvent(events, {
      id: `media_asset:${row.id}:created`,
      category: "media",
      label: "Media asset created",
      status: row.status,
      occurredAt: row.createdAt,
      entityType: "media_asset",
      entityId: row.id,
    })

    pushTimestampEvent(events, {
      id: `media_asset:${row.id}:uploaded`,
      category: "media",
      label: "Media uploaded",
      status: row.status,
      occurredAt: row.uploadedAt,
      entityType: "media_asset",
      entityId: row.id,
    })

    pushTimestampEvent(events, {
      id: `media_asset:${row.id}:ready`,
      category: "media",
      label: "Media ready for playback",
      status: row.status,
      occurredAt: row.readyAt,
      entityType: "media_asset",
      entityId: row.id,
    })
  }

  return events
}

export function normalizeSessionEventRows(
  rows: Array<{
    id: string
    eventType: string
    status: string
    createdAt: string
    triggeredAt: string | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    pushTimestampEvent(events, {
      id: `session_event:${row.id}:created`,
      category: "access",
      label: `Automation event (${row.eventType})`,
      status: row.status,
      occurredAt: row.triggeredAt ?? row.createdAt,
      entityType: "session_event",
      entityId: row.id,
    })
  }

  return events
}

export function normalizeAuditEvents(
  rows: Array<{
    id: string
    action: string
    targetType: string | null
    targetId: string | null
    correlationId: string | null
    createdAt: string
    metadata: Record<string, unknown> | null
  }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of rows) {
    const metadata = row.metadata ?? {}
    const detailParts = [
      metadata.toStatus ? `to ${String(metadata.toStatus)}` : null,
      metadata.fromStatus ? `from ${String(metadata.fromStatus)}` : null,
      metadata.kind ? `kind ${String(metadata.kind)}` : null,
    ].filter(Boolean)

    pushTimestampEvent(events, {
      id: `audit_log:${row.id}`,
      category: "audit",
      label: row.action.replaceAll(".", " "),
      occurredAt: row.createdAt,
      correlationId: row.correlationId ?? undefined,
      entityType: row.targetType ?? "audit_log",
      entityId: row.targetId ?? row.id,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
    })
  }

  return events
}

export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((left, right) => {
    const timeDelta =
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()

    if (timeDelta !== 0) {
      return timeDelta
    }

    return left.id.localeCompare(right.id)
  })
}

export function mergeTimelineEvents(...groups: TimelineEvent[][]): TimelineEvent[] {
  const byId = new Map<string, TimelineEvent>()

  for (const group of groups) {
    for (const event of group) {
      byId.set(event.id, event)
    }
  }

  return sortTimelineEvents([...byId.values()])
}
