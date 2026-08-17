import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { HURLINGHAM_VENUE_ID, MAIN_POD_RESOURCE_ID } from "../catalog/constants.ts"
import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0018_score_events.sql"),
  "utf8",
)

test("schema defines score events and snapshots", () => {
  assert.match(schemaSource, /score_events/)
  assert.match(schemaSource, /score_snapshots/)
  assert.match(schemaSource, /score_event_kind/)
  assert.match(schemaSource, /score_side/)
})

test("migration adds score tables with tenant composite foreign keys", () => {
  assert.match(migrationSource, /score_events_device_boot_sequence_unique/)
  assert.match(migrationSource, /score_snapshots_play_session_unique/)
  assert.match(migrationSource, /score_events_tenant_play_session_fk/)
  assert.match(migrationSource, /score_snapshots_tenant_play_session_fk/)
})

test("device events route uses dedicated device auth", () => {
  const route = readFileSync(
    join(repoRoot, "src/app/api/device/v1/events/route.ts"),
    "utf8",
  )

  assert.match(route, /requireDeviceRequest/)
  assert.match(route, /ingestScoreEvent/)
})

test("ingest rejects sequence gaps and returns duplicates safely", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { createEnrollment, provisionDevice, assignDevice } = await import(
    "../devices/devices.ts"
  )
  const { ingestScoreEvent } = await import("./ingest.ts")
  const { transitionPlaySession } = await import("../sessions/play-sessions.ts")
  const { ensurePlaySessionForBooking } = await import("../sessions/play-sessions.ts")
  const { DeviceError } = await import("../devices/errors.ts")
  const db = (await import("@/db/drizzle")).default
  const { bookings, playSessions } = await import("@/db/schema")
  const { eq } = await import("drizzle-orm")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-1" },
    role: "operator",
    membershipId: "membership-operator",
    correlationId: "corr-scoring-test",
  }

  const enrollment = await createEnrollment(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    deviceType: "esp32_controller",
  })

  const provisioned = await provisionDevice({
    enrollmentCode: enrollment.enrollmentCode,
    hardwareUid: `sim-score-${Date.now()}`,
    firmwareVersion: "0.3.0",
    correlationId: "corr-score-provision",
  })

  await assignDevice(operatorContext, {
    deviceId: provisioned.deviceId,
    locationId: HURLINGHAM_VENUE_ID,
    resourceId: MAIN_POD_RESOURCE_ID,
    role: "score_input",
  })

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.resourceId, MAIN_POD_RESOURCE_ID))
    .limit(1)

  assert.ok(booking, "expected a seeded booking on Main Pod")

  const playSession = await ensurePlaySessionForBooking(operatorContext, {
    id: booking.id,
    tenantId: booking.tenantId,
    locationId: booking.locationId,
    resourceId: booking.resourceId,
    userId: booking.userId,
    status: booking.status,
    paymentStatus: "paid",
    startTime: booking.startTime,
    endTime: booking.endTime,
  })

  await transitionPlaySession(
    operatorContext,
    playSession.id,
    "preparing",
    "test",
  )
  await transitionPlaySession(operatorContext, playSession.id, "active", "test")

  const [device] = await db
    .select()
    .from((await import("@/db/schema")).devices)
    .where(eq((await import("@/db/schema")).devices.id, provisioned.deviceId))
    .limit(1)

  assert.ok(device)

  const deviceRecord = {
    id: device.id,
    tenantId: device.tenantId,
    locationId: device.locationId,
    type: device.type,
    hardwareUid: device.hardwareUid,
    firmwareVersion: device.firmwareVersion,
    status: device.status,
    capabilityCodes: device.capabilityCodes ?? [],
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  }

  const first = await ingestScoreEvent({
    tenantId: PLAYTT_TENANT_ID,
    device: deviceRecord,
    bootId: "boot-score-1",
    sequence: 1,
    kind: "point",
    side: "a",
    correlationId: "corr-score-1",
  })

  assert.equal(first.duplicate, false)
  assert.equal(first.state.pointsA, 1)

  const duplicate = await ingestScoreEvent({
    tenantId: PLAYTT_TENANT_ID,
    device: deviceRecord,
    bootId: "boot-score-1",
    sequence: 1,
    kind: "point",
    side: "a",
    correlationId: "corr-score-dup",
  })

  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.state.pointsA, 1)

  await assert.rejects(
    () =>
      ingestScoreEvent({
        tenantId: PLAYTT_TENANT_ID,
        device: deviceRecord,
        bootId: "boot-score-1",
        sequence: 3,
        kind: "point",
        side: "a",
        correlationId: "corr-score-gap",
      }),
    (error) => error instanceof DeviceError && error.code === "SEQUENCE_GAP",
  )

  await transitionPlaySession(
    operatorContext,
    playSession.id,
    "ending",
    "test",
  )
  await transitionPlaySession(
    operatorContext,
    playSession.id,
    "completed",
    "test",
  )

  await assert.rejects(
    () =>
      ingestScoreEvent({
        tenantId: PLAYTT_TENANT_ID,
        device: deviceRecord,
        bootId: "boot-score-1",
        sequence: 2,
        kind: "point",
        side: "a",
        correlationId: "corr-score-inactive",
      }),
    (error) =>
      error instanceof DeviceError && error.code === "SESSION_INACTIVE",
  )
})
