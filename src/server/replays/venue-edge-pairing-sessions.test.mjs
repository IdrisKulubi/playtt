import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("pairing session routes and schema wiring exist", () => {
  const schema = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
  const migration = readFileSync(
    join(repoRoot, "drizzle", "0026_venue_edge_pairing_sessions.sql"),
    "utf8"
  )
  const consumedDeviceMigration = readFileSync(
    join(repoRoot, "drizzle", "0027_venue_edge_pairing_consumed_device.sql"),
    "utf8"
  )
  const integrityMigration = readFileSync(
    join(repoRoot, "drizzle", "0030_venue_edge_pairing_integrity.sql"),
    "utf8"
  )
  const enrollmentService = readFileSync(
    join(repoRoot, "src", "server", "replays", "venue-edge-enrollment.ts"),
    "utf8"
  )
  const pairingService = readFileSync(
    join(
      repoRoot,
      "src",
      "server",
      "replays",
      "venue-edge-pairing-sessions.ts"
    ),
    "utf8"
  )
  const route = readFileSync(
    join(repoRoot, "src/app/api/operator/venue-edge/pairing-sessions/route.ts"),
    "utf8"
  )
  const exchangeRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/enroll/exchange/route.ts"),
    "utf8"
  )
  const confirmRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/enroll/confirm/route.ts"),
    "utf8"
  )

  assert.match(schema, /venueEdgePairingSessions/)
  assert.match(schema, /venueEdgePairingRateLimits/)
  assert.match(schema, /consumedDeviceId/)
  assert.match(migration, /venue_edge_pairing_sessions/)
  assert.match(migration, /venue_edge_pairing_rate_limits/)
  assert.match(consumedDeviceMigration, /consumed_device_id/)
  assert.match(
    integrityMigration,
    /venue_edge_pairing_sessions_code_hash_unique[^;]+\("code_hash"\)/
  )
  assert.match(
    integrityMigration,
    /venue_edge_pairing_sessions_consumed_tenant_device_fk[^;]+\("tenant_id","consumed_device_id"\)[^;]+devices"\("tenant_id","id"\)/
  )
  assert.match(
    integrityMigration,
    /venue_edge_pairing_sessions_lifecycle_consistent[\s\S]+NOT VALID/
  )
  assert.match(schema, /venue_edge_pairing_sessions_lifecycle_consistent/)
  assert.match(
    pairingService,
    /eq\(venueEdgePairingSessions\.status, "waiting_for_install"\)/
  )
  assert.match(
    enrollmentService,
    /status: "consumed",\s+consumedAt: now,\s+consumedDeviceId: deviceId/
  )
  const confirmationTransaction = enrollmentService.indexOf(
    "export async function confirmVenueEdgeEnrollment"
  )
  const replacementRevocation = enrollmentService.indexOf(
    "await revokeDeviceInTransaction(",
    confirmationTransaction
  )
  assert.ok(confirmationTransaction >= 0)
  assert.ok(replacementRevocation > confirmationTransaction)
  assert.doesNotMatch(
    enrollmentService.slice(0, confirmationTransaction),
    /await revokeDeviceInTransaction\(/
  )
  assert.match(route, /createVenueEdgePairingSession/)
  assert.match(route, /resolveOperatorDeviceWriteContext/)
  assert.match(exchangeRoute, /exchangeVenueEdgeEnrollment/)
  assert.match(confirmRoute, /confirmVenueEdgeEnrollment/)
})

test("pairing code format is human-friendly and hashed with venue-edge prefix", async () => {
  const {
    generateVenueEdgePairingCode,
    hashVenueEdgePairingCode,
    normalizeVenueEdgePairingCode,
  } = await import("./venue-edge-pairing-credentials.ts")

  const generated = generateVenueEdgePairingCode()
  assert.match(generated.pairingCode, /^[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{6}$/)
  assert.equal(generated.codeHint, generated.normalized.slice(-4))
  assert.equal(
    normalizeVenueEdgePairingCode(generated.pairingCode),
    generated.normalized
  )
  assert.notEqual(
    hashVenueEdgePairingCode(generated.pairingCode),
    hashVenueEdgePairingCode("ABCD-EFGHJK")
  )
})

test("online lifecycle requires a fresh heartbeat", () => {
  const enrollment = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-enrollment.ts"),
    "utf8"
  )
  const sessions = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-pairing-sessions.ts"),
    "utf8"
  )

  assert.match(enrollment, /deriveDeviceHealth\(lastHeartbeatAt, input\.now\)/)
  assert.match(enrollment, /\? "online"\s+: "offline"/)
  assert.match(enrollment, /PAIRING_HEARTBEAT_REQUIRED/)
  assert.match(enrollment, /requires a fresh heartbeat/)
  assert.match(enrollment, /deviceHeartbeats\.tenantId/)
  assert.match(enrollment, /desc\(deviceHeartbeats\.observedAt\)/)
  assert.match(sessions, /lastHeartbeatAt: devices\.lastHeartbeatAt/)
})

test("enrollment uses typed service context and lookup failures count once", () => {
  const enrollment = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-enrollment.ts"),
    "utf8"
  )
  const exchangeRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/enroll/exchange/route.ts"),
    "utf8"
  )
  const rateLimit = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-pairing-rate-limit.ts"),
    "utf8"
  )

  assert.match(enrollment, /tenancy\/context-factory"/)
  assert.doesNotMatch(enrollment, /tenancy\/context-factory\.mjs/)
  assert.doesNotMatch(enrollment, /recordFailedPairingLookup/)
  assert.match(exchangeRoute, /recordFailedPairingLookup/)
  assert.match(rateLimit, /type RedisRateLimitClient/)
  assert.match(rateLimit, /await client\.quit\(\)/)
  assert.doesNotMatch(rateLimit, /await client\.disconnect\(\)/)
})

test("venue edge pairing sessions work when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { eq } = await import("drizzle-orm")
  const db = (await import("../../../db/drizzle.ts")).default
  const { auditLogs, venueEdgePairingSessions } =
    await import("../../../db/schema.ts")
  const { HURLINGHAM_VENUE_ID } = await import("../catalog/constants.ts")
  const { DeviceError } = await import("../devices/errors.ts")
  const { PLAYTT_TENANT_ID } = await import("../tenancy/constants.ts")
  const { hashVenueEdgePairingCode } =
    await import("./venue-edge-pairing-credentials.ts")
  const { PAIRING_CREATE_RATE_LIMIT } =
    await import("./venue-edge-pairing-rate-limit.ts")
  const {
    cancelVenueEdgePairingSession,
    createVenueEdgePairingSession,
    reissueVenueEdgePairingSession,
    resolveVenueEdgePairingSessionFromCode,
  } = await import("./venue-edge-pairing-sessions.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-pairing-test" },
    role: "operator",
    membershipId: "membership-operator-pairing",
    correlationId: `corr-pairing-${Date.now()}`,
  }

  const created = await createVenueEdgePairingSession(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    expiresInMinutes: 15,
  })

  assert.ok(created.pairingCode)
  assert.equal(created.status, "waiting_for_install")
  assert.match(created.pairingCode, /^[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{6}$/)

  const [stored] = await db
    .select()
    .from(venueEdgePairingSessions)
    .where(eq(venueEdgePairingSessions.id, created.id))
    .limit(1)

  assert.ok(stored)
  assert.equal(stored.codeHash, hashVenueEdgePairingCode(created.pairingCode))
  assert.equal(stored.codeHint, created.codeHint)
  assert.notEqual(stored.codeHash, created.pairingCode)

  const resolved = await resolveVenueEdgePairingSessionFromCode({
    tenantId: PLAYTT_TENANT_ID,
    locationId: HURLINGHAM_VENUE_ID,
    pairingCode: created.pairingCode,
    lookupSubject: "test-ip-1",
  })
  assert.equal(resolved?.id, created.id)

  const guessed = await resolveVenueEdgePairingSessionFromCode({
    tenantId: PLAYTT_TENANT_ID,
    locationId: HURLINGHAM_VENUE_ID,
    pairingCode: "ABCD-EFGHJK",
    lookupSubject: "test-ip-guess",
  })
  assert.equal(guessed, null)

  const wrongVenue = await resolveVenueEdgePairingSessionFromCode({
    tenantId: PLAYTT_TENANT_ID,
    locationId: "22222222-2222-2222-2222-222222222222",
    pairingCode: created.pairingCode,
    lookupSubject: "test-ip-wrong-venue",
  })
  assert.equal(wrongVenue, null)

  const reissued = await reissueVenueEdgePairingSession(
    {
      ...operatorContext,
      correlationId: `corr-reissue-${Date.now()}`,
    },
    created.id
  )
  assert.notEqual(reissued.id, created.id)
  assert.notEqual(reissued.pairingCode, created.pairingCode)
  assert.equal(reissued.status, "waiting_for_install")

  const cancelled = await cancelVenueEdgePairingSession(
    operatorContext,
    reissued.id
  )
  assert.equal(cancelled.status, "cancelled")

  await assert.rejects(
    () =>
      resolveVenueEdgePairingSessionFromCode({
        tenantId: PLAYTT_TENANT_ID,
        locationId: HURLINGHAM_VENUE_ID,
        pairingCode: reissued.pairingCode,
        lookupSubject: "test-ip-cancelled",
      }),
    DeviceError
  )

  const expiredContext = {
    ...operatorContext,
    correlationId: `corr-expired-${Date.now()}`,
  }
  const shortLived = await createVenueEdgePairingSession(expiredContext, {
    locationId: HURLINGHAM_VENUE_ID,
    expiresInMinutes: 0,
  })

  await assert.rejects(
    () =>
      resolveVenueEdgePairingSessionFromCode({
        tenantId: PLAYTT_TENANT_ID,
        locationId: HURLINGHAM_VENUE_ID,
        pairingCode: shortLived.pairingCode,
        lookupSubject: "test-ip-expired",
        now: new Date(Date.now() + 60_000),
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID"
  )

  const auditRows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.correlationId, operatorContext.correlationId))

  assert.ok(auditRows.length > 0)
  for (const row of auditRows) {
    const metadata = JSON.stringify(row.metadata ?? {})
    assert.doesNotMatch(metadata, new RegExp(created.pairingCode))
    assert.doesNotMatch(metadata, /venue-edge-pairing:/)
  }
})

test("pairing create rate limit is enforced across repeated creates", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { HURLINGHAM_VENUE_ID } = await import("../catalog/constants.ts")
  const { DeviceError } = await import("../devices/errors.ts")
  const { PLAYTT_TENANT_ID } = await import("../tenancy/constants.ts")
  const { PAIRING_CREATE_RATE_LIMIT } =
    await import("./venue-edge-pairing-rate-limit.ts")
  const { createVenueEdgePairingSession } =
    await import("./venue-edge-pairing-sessions.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-rate-limit" },
    role: "operator",
    membershipId: "membership-operator-rate",
    correlationId: `corr-rate-${Date.now()}`,
  }

  const venueId = HURLINGHAM_VENUE_ID

  for (
    let index = 0;
    index < PAIRING_CREATE_RATE_LIMIT.maxAttempts;
    index += 1
  ) {
    const session = await createVenueEdgePairingSession(operatorContext, {
      locationId: venueId,
    })
    assert.ok(session.pairingCode)
  }

  await assert.rejects(
    () =>
      createVenueEdgePairingSession(operatorContext, {
        locationId: venueId,
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_RATE_LIMITED"
  )
})

test("venue edge enrollment exchange and confirm work when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { randomUUID } = await import("node:crypto")
  const { and, eq } = await import("drizzle-orm")
  const db = (await import("../../../db/drizzle.ts")).default
  const {
    auditLogs,
    deviceCredentials,
    devices,
    venueEdgeInstallations,
    venueEdgePairingSessions,
  } = await import("../../../db/schema.ts")
  const { HURLINGHAM_VENUE_ID } = await import("../catalog/constants.ts")
  const { authenticateDeviceCredential } = await import("../devices/devices.ts")
  const { DeviceError } = await import("../devices/errors.ts")
  const { recordDeviceHeartbeat } = await import("../devices/heartbeats.ts")
  const { PLAYTT_TENANT_ID } = await import("../tenancy/constants.ts")
  const { resolveTenantContextForDevice } =
    await import("../tenancy/context-factory.mjs")
  const { confirmVenueEdgeEnrollment, exchangeVenueEdgeEnrollment } =
    await import("./venue-edge-enrollment.ts")
  const {
    cancelVenueEdgePairingSession,
    createVenueEdgePairingSession,
    listVenueEdgePairingSessions,
  } = await import("./venue-edge-pairing-sessions.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-enrollment-test" },
    role: "operator",
    membershipId: "membership-operator-enrollment",
    correlationId: `corr-enrollment-${Date.now()}`,
  }

  const enrollmentBase = {
    platform: "windows",
    architecture: "x64",
    agentVersion: "0.3.0-p3-02",
    lookupSubject: "test-ip-enrollment",
    correlationId: `corr-exchange-${Date.now()}`,
  }

  const created = await createVenueEdgePairingSession(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    expiresInMinutes: 15,
  })

  const installationUid = randomUUID()
  const exchanged = await exchangeVenueEdgeEnrollment({
    pairingCode: created.pairingCode,
    installationUid,
    ...enrollmentBase,
  })

  assert.equal(exchanged.status, "pending_setup")
  assert.equal(exchanged.credentialVersion, 1)
  assert.ok(exchanged.secret)
  assert.equal(exchanged.tenantId, PLAYTT_TENANT_ID)
  assert.equal(exchanged.locationId, HURLINGHAM_VENUE_ID)
  assert.ok(exchanged.installationId)
  assert.notEqual(exchanged.installationId, installationUid)

  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, exchanged.deviceId))
    .limit(1)

  assert.ok(device)
  assert.equal(device.status, "pending")
  assert.equal(device.type, "venue_edge")
  assert.equal(device.hardwareUid, installationUid)

  const [installation] = await db
    .select()
    .from(venueEdgeInstallations)
    .where(eq(venueEdgeInstallations.id, exchanged.installationId))
    .limit(1)

  assert.ok(installation)
  assert.equal(installation.installationUid, installationUid)
  assert.equal(installation.edgeDeviceId, exchanged.deviceId)

  const activeCredentials = await db
    .select()
    .from(deviceCredentials)
    .where(
      and(
        eq(deviceCredentials.deviceId, exchanged.deviceId),
        eq(deviceCredentials.status, "active")
      )
    )

  assert.equal(activeCredentials.length, 1)

  const listedAfterExchange = await listVenueEdgePairingSessions(
    operatorContext,
    HURLINGHAM_VENUE_ID
  )
  const consumedSession = listedAfterExchange.find(
    (row) => row.id === created.id
  )
  assert.ok(consumedSession)
  assert.equal(consumedSession.status, "consumed")
  assert.equal(consumedSession.lifecycleStatus, "pending_setup")
  assert.equal(consumedSession.consumedDeviceId, exchanged.deviceId)

  const credentialAuth = await authenticateDeviceCredential({
    deviceId: exchanged.deviceId,
    secret: exchanged.secret,
  })
  assert.equal(credentialAuth.device.status, "pending")

  const auth = {
    ...credentialAuth,
    context: resolveTenantContextForDevice({
      deviceId: credentialAuth.device.id,
      tenantId: credentialAuth.device.tenantId,
      correlationId: `corr-confirm-${Date.now()}`,
    }),
  }

  await assert.rejects(
    () => confirmVenueEdgeEnrollment(auth),
    (error) =>
      error instanceof DeviceError &&
      error.code === "PAIRING_HEARTBEAT_REQUIRED"
  )

  await recordDeviceHeartbeat({
    tenantId: exchanged.tenantId,
    deviceId: exchanged.deviceId,
    bootId: "boot-enrollment-1",
    correlationId: "corr-enrollment-heartbeat",
    appliedConfigVersion: 1,
  })

  const confirmed = await confirmVenueEdgeEnrollment(auth)
  assert.equal(confirmed.status, "online")
  assert.equal(confirmed.alreadyConfirmed, false)
  assert.equal(confirmed.deviceId, exchanged.deviceId)

  const [activeDevice] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, exchanged.deviceId))
    .limit(1)

  assert.equal(activeDevice.status, "active")

  const listedAfterConfirm = await listVenueEdgePairingSessions(
    operatorContext,
    HURLINGHAM_VENUE_ID
  )
  const onlineSession = listedAfterConfirm.find((row) => row.id === created.id)
  assert.ok(onlineSession)
  assert.equal(onlineSession.lifecycleStatus, "online")

  const duplicateConfirm = await confirmVenueEdgeEnrollment(auth)
  assert.equal(duplicateConfirm.alreadyConfirmed, true)

  const replacementSession = await createVenueEdgePairingSession(
    {
      ...operatorContext,
      correlationId: `corr-replacement-${Date.now()}`,
    },
    {
      locationId: HURLINGHAM_VENUE_ID,
      replaceInstallationId: installation.id,
    }
  )
  const replacementExchange = await exchangeVenueEdgeEnrollment({
    pairingCode: replacementSession.pairingCode,
    installationUid: randomUUID(),
    ...enrollmentBase,
    lookupSubject: "test-ip-replacement",
    correlationId: `corr-replacement-exchange-${Date.now()}`,
  })

  const [oldDeviceBeforeReplacementConfirm] = await db
    .select({ status: devices.status })
    .from(devices)
    .where(eq(devices.id, exchanged.deviceId))
    .limit(1)
  assert.equal(oldDeviceBeforeReplacementConfirm.status, "active")

  const replacementCredentialAuth = await authenticateDeviceCredential({
    deviceId: replacementExchange.deviceId,
    secret: replacementExchange.secret,
  })
  const replacementAuth = {
    ...replacementCredentialAuth,
    context: resolveTenantContextForDevice({
      deviceId: replacementCredentialAuth.device.id,
      tenantId: replacementCredentialAuth.device.tenantId,
      correlationId: `corr-replacement-confirm-${Date.now()}`,
    }),
  }

  await recordDeviceHeartbeat({
    tenantId: replacementExchange.tenantId,
    deviceId: replacementExchange.deviceId,
    bootId: "boot-replacement-1",
    correlationId: "corr-replacement-heartbeat",
    appliedConfigVersion: 1,
  })
  await confirmVenueEdgeEnrollment(replacementAuth)

  const [oldDeviceAfterReplacementConfirm] = await db
    .select({ status: devices.status })
    .from(devices)
    .where(eq(devices.id, exchanged.deviceId))
    .limit(1)
  const [newDeviceAfterReplacementConfirm] = await db
    .select({ status: devices.status })
    .from(devices)
    .where(eq(devices.id, replacementExchange.deviceId))
    .limit(1)
  assert.equal(oldDeviceAfterReplacementConfirm.status, "revoked")
  assert.equal(newDeviceAfterReplacementConfirm.status, "active")

  const concurrentSession = await createVenueEdgePairingSession(
    {
      ...operatorContext,
      correlationId: `corr-concurrent-${Date.now()}`,
    },
    {
      locationId: HURLINGHAM_VENUE_ID,
    }
  )

  const concurrentResults = await Promise.allSettled([
    exchangeVenueEdgeEnrollment({
      pairingCode: concurrentSession.pairingCode,
      installationUid: randomUUID(),
      ...enrollmentBase,
      lookupSubject: "test-ip-concurrent-1",
      correlationId: `corr-concurrent-1-${Date.now()}`,
    }),
    exchangeVenueEdgeEnrollment({
      pairingCode: concurrentSession.pairingCode,
      installationUid: randomUUID(),
      ...enrollmentBase,
      lookupSubject: "test-ip-concurrent-2",
      correlationId: `corr-concurrent-2-${Date.now()}`,
    }),
  ])

  const winners = concurrentResults.filter(
    (result) => result.status === "fulfilled"
  )
  const losers = concurrentResults.filter(
    (result) => result.status === "rejected"
  )
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 1)
  assert.ok(losers[0].reason instanceof DeviceError)
  assert.equal(losers[0].reason.code, "PAIRING_SESSION_INVALID")

  const winnerDeviceId = winners[0].value.deviceId
  const concurrentInstallations = await db
    .select({ id: venueEdgeInstallations.id })
    .from(venueEdgeInstallations)
    .where(eq(venueEdgeInstallations.edgeDeviceId, winnerDeviceId))

  assert.equal(concurrentInstallations.length, 1)

  const concurrentCredentials = await db
    .select()
    .from(deviceCredentials)
    .where(
      and(
        eq(deviceCredentials.deviceId, winnerDeviceId),
        eq(deviceCredentials.status, "active")
      )
    )

  assert.equal(concurrentCredentials.length, 1)

  const cancelledSession = await createVenueEdgePairingSession(
    operatorContext,
    { locationId: HURLINGHAM_VENUE_ID }
  )
  await cancelVenueEdgePairingSession(operatorContext, cancelledSession.id)

  await assert.rejects(
    () =>
      exchangeVenueEdgeEnrollment({
        pairingCode: cancelledSession.pairingCode,
        installationUid: randomUUID(),
        ...enrollmentBase,
        lookupSubject: "test-ip-cancelled-exchange",
        correlationId: `corr-cancelled-${Date.now()}`,
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID"
  )

  const expiredSession = await createVenueEdgePairingSession(
    {
      ...operatorContext,
      correlationId: `corr-expired-exchange-${Date.now()}`,
    },
    {
      locationId: HURLINGHAM_VENUE_ID,
      expiresInMinutes: 0,
    }
  )

  await assert.rejects(
    () =>
      exchangeVenueEdgeEnrollment({
        pairingCode: expiredSession.pairingCode,
        installationUid: randomUUID(),
        ...enrollmentBase,
        lookupSubject: "test-ip-expired-exchange",
        correlationId: `corr-expired-exchange-${Date.now()}`,
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID"
  )

  await assert.rejects(
    () =>
      exchangeVenueEdgeEnrollment({
        pairingCode: "ABCD-EFGHJK",
        installationUid: randomUUID(),
        ...enrollmentBase,
        lookupSubject: "test-ip-guessed-exchange",
        correlationId: `corr-guessed-${Date.now()}`,
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID"
  )

  await assert.rejects(
    () =>
      exchangeVenueEdgeEnrollment({
        pairingCode: created.pairingCode,
        installationUid: randomUUID(),
        ...enrollmentBase,
        lookupSubject: "test-ip-reused-exchange",
        correlationId: `corr-reused-${Date.now()}`,
      }),
    (error) =>
      error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID"
  )

  const [consumedPairingRow] = await db
    .select()
    .from(venueEdgePairingSessions)
    .where(eq(venueEdgePairingSessions.id, created.id))
    .limit(1)

  assert.equal(consumedPairingRow.status, "consumed")

  const exchangeAuditRows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.correlationId, enrollmentBase.correlationId))

  assert.ok(exchangeAuditRows.length > 0)
  for (const row of exchangeAuditRows) {
    const metadata = JSON.stringify(row.metadata ?? {})
    assert.doesNotMatch(metadata, new RegExp(created.pairingCode))
    assert.doesNotMatch(metadata, new RegExp(exchanged.secret))
    assert.doesNotMatch(metadata, /venue-edge-pairing:/)
  }
})
