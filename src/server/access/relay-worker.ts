import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { relayChannels, sessionEvents } from "@/db/schema"
import { isAccessFeatureEnabled } from "@/server/access/feature-policy"
import {
  DeviceCommandRelayProvider,
  SimulatedRelayProvider,
} from "@/server/access/relay-providers"
import type { RelayCommandInput } from "@/server/access/types"
import { postgresDeviceCommandBus } from "@/server/devices/commands"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import type { TenantContext } from "@/server/tenancy/types"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

const RELAY_LEAD_SECONDS = 15 * 60

type RelayDesiredState = RelayCommandInput["desiredState"]

const STATUS_RELAY_ACTIONS: Partial<
  Record<string, { desiredState: RelayDesiredState; sessionEventType: string }>
> = {
  preparing: { desiredState: "on", sessionEventType: "lights_on" },
  ending: { desiredState: "warning", sessionEventType: "warning_flash" },
  completed: { desiredState: "off", sessionEventType: "lights_off" },
  resetting: { desiredState: "reset", sessionEventType: "lights_off" },
}

function relayProvider() {
  if (process.env.RELAY_PROVIDER_MODE === "device") {
    return new DeviceCommandRelayProvider(
      postgresDeviceCommandBus,
      async (input) => {
        const [channel] = await db
          .select({ deviceId: relayChannels.deviceId })
          .from(relayChannels)
          .where(
            and(
              eq(relayChannels.tenantId, input.tenantId),
              eq(relayChannels.resourceId, input.resourceId),
              eq(relayChannels.channelKey, input.channel),
              eq(relayChannels.isActive, true),
            ),
          )
          .limit(1)
        if (!channel) throw new Error("Relay channel is not configured.")
        return channel.deviceId
      },
    )
  }
  return new SimulatedRelayProvider()
}

export async function scheduleRelayActionsForSessionTransition(input: {
  tenantId: string
  bookingId: string
  playSessionId: string
  locationId: string
  resourceId: string
  correlationId: string
  toStatus: string
}) {
  const action = STATUS_RELAY_ACTIONS[input.toStatus]
  if (!action) return null

  const context = createServiceTenantContext({
    tenantId: input.tenantId,
    actorId: "relay-orchestration",
    correlationId: input.correlationId,
  })
  if (!(await isAccessFeatureEnabled(context, "relayAutomation"))) return null

  return enqueueOutboxEvent({
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "play_session",
    aggregateId: input.playSessionId,
    eventType: EVENT_TYPES.RELAY_ACTION_REQUESTED_V1,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    payload: {
      bookingId: input.bookingId,
      playSessionId: input.playSessionId,
      locationId: input.locationId,
      resourceId: input.resourceId,
      toStatus: input.toStatus,
      desiredState: action.desiredState,
      sessionEventType: action.sessionEventType,
    },
    idempotencyKey: `relay.action.requested.v1:${input.playSessionId}:${input.toStatus}`,
  })
}

async function recordSessionEvent(
  context: TenantContext,
  input: {
    bookingId: string
    playSessionId: string
    locationId: string
    eventType: string
    status: "pending" | "success" | "failed" | "skipped"
    payload?: Record<string, unknown>
  },
) {
  await db.insert(sessionEvents).values({
    tenantId: context.tenantId,
    bookingId: input.bookingId,
    playSessionId: input.playSessionId,
    locationId: input.locationId,
    eventType: input.eventType as "lights_on",
    status: input.status,
    payload: input.payload ?? {},
    triggeredAt: new Date(),
  })
}

export async function consumeRelayActionRequested(row: {
  tenantId: string | null
  correlationId: string
  payload: Record<string, unknown>
}) {
  const tenantId = row.tenantId
  const bookingId = String(row.payload.bookingId ?? "")
  const playSessionId = String(row.payload.playSessionId ?? "")
  const locationId = String(row.payload.locationId ?? "")
  const resourceId = String(row.payload.resourceId ?? "")
  const desiredState = String(row.payload.desiredState ?? "") as RelayDesiredState
  const sessionEventType = String(row.payload.sessionEventType ?? "lights_on")
  const toStatus = String(row.payload.toStatus ?? "")

  if (!tenantId || !bookingId || !playSessionId || !resourceId || !desiredState) {
    throw new Error("relay.action.requested.v1 event is incomplete.")
  }

  const context = createServiceTenantContext({
    tenantId,
    actorId: "relay-worker",
    correlationId: row.correlationId,
  })

  const channels = await db
    .select()
    .from(relayChannels)
    .where(
      and(
        eq(relayChannels.tenantId, tenantId),
        eq(relayChannels.resourceId, resourceId),
        eq(relayChannels.isActive, true),
      ),
    )

  if (channels.length === 0) {
    await recordSessionEvent(context, {
      bookingId,
      playSessionId,
      locationId,
      eventType: sessionEventType,
      status: "skipped",
      payload: { reason: "no_relay_channels", toStatus },
    })
    return { skipped: true }
  }

  const provider = relayProvider()
  const expiresAt = new Date(Date.now() + RELAY_LEAD_SECONDS * 1000)
  let failed = false

  for (const channel of channels) {
    const commandInput: RelayCommandInput = {
      tenantId,
      venueId: locationId,
      resourceId,
      playSessionId,
      correlationId: row.correlationId,
      channel: channel.channelKey,
      desiredState,
      expiresAt,
      idempotencyKey: `relay:${playSessionId}:${toStatus}:${channel.channelKey}`,
    }

    try {
      await provider.execute(commandInput)
    } catch (error) {
      failed = true
      await recordSessionEvent(context, {
        bookingId,
        playSessionId,
        locationId,
        eventType: sessionEventType,
        status: "failed",
        payload: {
          channel: channel.channelKey,
          message: error instanceof Error ? error.message : "Relay command failed.",
        },
      })
    }
  }

  if (!failed) {
    await recordSessionEvent(context, {
      bookingId,
      playSessionId,
      locationId,
      eventType: sessionEventType,
      status: "success",
      payload: { toStatus, channelCount: channels.length },
    })
  }

  return { failed, channelCount: channels.length }
}

export function createRelayConsumers() {
  return {
    [EVENT_TYPES.RELAY_ACTION_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeRelayActionRequested,
    },
  }
}
