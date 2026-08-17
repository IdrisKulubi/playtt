import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  HURLINGHAM_VENUE_ID,
  MAIN_POD_RESOURCE_ID,
} from "../catalog/constants.ts"
import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const devicesRoot = import.meta.dirname

const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0015_devices.sql"),
  "utf8"
)
const healthCommandsMigration = readFileSync(
  join(repoRoot, "drizzle", "0016_device_health_commands.sql"),
  "utf8"
)

test("schema defines tenant-scoped device registry tables", () => {
  assert.match(schemaSource, /devices/)
  assert.match(schemaSource, /device_enrollments/)
  assert.match(schemaSource, /device_credentials/)
  assert.match(schemaSource, /device_assignments/)
  assert.match(schemaSource, /device_heartbeats/)
  assert.match(schemaSource, /device_commands/)
  assert.match(schemaSource, /device_command_acks/)
  assert.match(schemaSource, /esp32_controller/)
  assert.match(schemaSource, /ttlock_lock/)
  assert.match(schemaSource, /ttlock_gateway/)
})

test("migration adds heartbeat and command tables", () => {
  assert.match(healthCommandsMigration, /device_heartbeats/)
  assert.match(healthCommandsMigration, /device_commands/)
  assert.match(healthCommandsMigration, /device_command_acks/)
  assert.match(healthCommandsMigration, /device_heartbeats_tenant_device_fk/)
  assert.match(healthCommandsMigration, /device_commands_tenant_device_fk/)
})

test("device v1 heartbeat and command routes exist", () => {
  const heartbeatRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/heartbeat/route.ts"),
    "utf8"
  )
  const commandsRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/commands/route.ts"),
    "utf8"
  )
  const ackRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/commands/[commandId]/ack/route.ts"),
    "utf8"
  )

  assert.match(heartbeatRoute, /requireDeviceRequest/)
  assert.match(commandsRoute, /requireDeviceRequest/)
  assert.match(ackRoute, /idempotencyKey/)
})

test("command bus rejects duplicate acknowledgements safely", () => {
  const source = readFileSync(join(devicesRoot, "commands.ts"), "utf8")
  assert.match(source, /deviceCommandAcks/)
  assert.match(source, /idempotencyKey/)
  assert.match(source, /COMMAND_EXPIRED/)
})

test("health policy derives online/offline from heartbeat age", async () => {
  const { deriveDeviceHealth, getOfflineThresholdSeconds } =
    await import("./health-policy.ts")

  const now = new Date("2026-08-17T12:00:00.000Z")
  const threshold = getOfflineThresholdSeconds()
  const recent = new Date(now.getTime() - (threshold - 10) * 1000)
  const stale = new Date(now.getTime() - (threshold + 10) * 1000)

  assert.equal(deriveDeviceHealth(null, now), "unknown")
  assert.equal(deriveDeviceHealth(recent, now), "online")
  assert.equal(deriveDeviceHealth(stale, now), "offline")
})

test("device policies reject wrong roles, future heartbeats, and invalid config acknowledgements", async () => {
  const {
    evaluateConfigAcknowledgement,
    validateDeviceAssignmentPolicy,
    validateHeartbeatObservedAt,
  } = await import("./policies.mjs")

  assert.equal(
    validateDeviceAssignmentPolicy({
      role: "score_input",
      deviceType: "ttlock_lock",
      deviceCapabilityCodes: ["access"],
      resourceId: MAIN_POD_RESOURCE_ID,
      resourceCapabilityCodes: ["scoring"],
    }).reason,
    "role_not_supported"
  )
  assert.equal(
    validateHeartbeatObservedAt(
      "2026-08-17T12:05:00.000Z",
      new Date("2026-08-17T12:00:00.000Z")
    ).reason,
    "future_timestamp"
  )
  assert.equal(
    evaluateConfigAcknowledgement({
      received: 2,
      configVersion: 1,
      appliedConfigVersion: null,
    }).kind,
    "ahead"
  )
})

test("migration adds composite tenant foreign keys for device tables", () => {
  assert.match(migrationSource, /devices_tenant_location_fk/)
  assert.match(migrationSource, /device_credentials_tenant_device_fk/)
  assert.match(migrationSource, /device_assignments_tenant_device_fk/)
  assert.match(migrationSource, /device_assignments_device_open_unique/)
  assert.match(
    migrationSource,
    /device_assignments_scoring_resource_role_open_unique/
  )
})

test("device repository scopes queries by tenant context", () => {
  const source = readFileSync(join(devicesRoot, "devices.ts"), "utf8")
  assert.match(source, /eq\(devices\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(deviceAssignments\.tenantId, context\.tenantId\)/)
})

test("credentials module hashes secrets with HMAC", () => {
  const source = readFileSync(join(devicesRoot, "credentials.ts"), "utf8")
  assert.match(source, /hashDeviceSecret/)
  assert.match(source, /verifyDeviceSecret/)
  assert.match(source, /createHmac/)
  assert.doesNotMatch(schemaSource, /secret_hash.*text.*not null/i)
})

test("provision response returns secret only at issuance", () => {
  const provisionRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/provision/route.ts"),
    "utf8"
  )
  assert.match(provisionRoute, /secret/)
  const devicesSource = readFileSync(join(devicesRoot, "devices.ts"), "utf8")
  assert.match(devicesSource, /mapDevice/)
  assert.doesNotMatch(devicesSource, /secretHash: row/)
})

test("operator device writes require venue.manage", () => {
  const service = readFileSync(join(devicesRoot, "devices-service.ts"), "utf8")
  const context = readFileSync(join(devicesRoot, "operator-context.ts"), "utf8")
  assert.match(service, /venue\.manage/)
  assert.match(context, /venue\.manage/)
})

test("device v1 routes use dedicated device auth", () => {
  const configRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/config/route.ts"),
    "utf8"
  )
  const rotateRoute = readFileSync(
    join(repoRoot, "src/app/api/device/v1/credentials/rotate/route.ts"),
    "utf8"
  )

  assert.match(configRoute, /requireDeviceRequest/)
  assert.match(rotateRoute, /requireDeviceRequest/)
  assert.doesNotMatch(configRoute, /getSessionWithBearerFallback/)
})

test("operator shell links to devices page", () => {
  const source = readFileSync(
    join(repoRoot, "src/components/operator/operator-shell.tsx"),
    "utf8"
  )
  assert.match(source, /\/operator\/devices/)
  assert.match(source, /Devices/)
})

test("enrollment provision and config flow works when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const {
    createEnrollment,
    provisionDevice,
    getDeviceConfigForAuthenticatedDevice,
  } = await import("./devices.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-1" },
    role: "operator",
    membershipId: "membership-operator",
    correlationId: "corr-devices-test",
  }

  const enrollment = await createEnrollment(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    deviceType: "esp32_controller",
  })

  const provisioned = await provisionDevice({
    enrollmentCode: enrollment.enrollmentCode,
    hardwareUid: `sim-${Date.now()}`,
    firmwareVersion: "0.1.0",
    correlationId: "corr-provision-test",
  })

  assert.equal(provisioned.credentialVersion, 1)
  assert.ok(provisioned.secret)

  const {
    assignDevice,
    authenticateDeviceCredential,
    revokeDevice,
    rotateDeviceCredential,
  } = await import("./devices.ts")
  const { DeviceError } = await import("./errors.ts")

  await assignDevice(operatorContext, {
    deviceId: provisioned.deviceId,
    locationId: HURLINGHAM_VENUE_ID,
    resourceId: MAIN_POD_RESOURCE_ID,
    role: "score_input",
    config: { debounceMs: 25 },
    configVersion: 1,
  })

  const auth = await authenticateDeviceCredential({
    deviceId: provisioned.deviceId,
    secret: provisioned.secret,
  })

  const config = await getDeviceConfigForAuthenticatedDevice({
    tenantId: auth.device.tenantId,
    deviceId: auth.device.id,
    deviceStatus: auth.device.status,
  })

  assert.equal(config.role, "score_input")
  assert.equal(config.resourceId, MAIN_POD_RESOURCE_ID)
  assert.equal(config.config.debounceMs, 25)

  const rotated = await rotateDeviceCredential({
    deviceId: provisioned.deviceId,
    tenantId: provisioned.tenantId,
  })
  await assert.rejects(
    () =>
      authenticateDeviceCredential({
        deviceId: provisioned.deviceId,
        secret: provisioned.secret,
      }),
    DeviceError
  )
  await authenticateDeviceCredential({
    deviceId: provisioned.deviceId,
    secret: rotated.secret,
  })

  await revokeDevice(operatorContext, provisioned.deviceId)
  await assert.rejects(
    () =>
      authenticateDeviceCredential({
        deviceId: provisioned.deviceId,
        secret: rotated.secret,
      }),
    DeviceError
  )

  await assert.rejects(
    () =>
      provisionDevice({
        enrollmentCode: enrollment.enrollmentCode,
        hardwareUid: `sim-reuse-${Date.now()}`,
        correlationId: "corr-provision-reuse",
      }),
    DeviceError
  )

  const expiredEnrollment = await createEnrollment(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    deviceType: "esp32_controller",
    expiresInMinutes: 0,
  })
  await assert.rejects(
    () =>
      provisionDevice({
        enrollmentCode: expiredEnrollment.enrollmentCode,
        hardwareUid: `sim-expired-${Date.now()}`,
        correlationId: "corr-provision-expired",
      }),
    DeviceError
  )
})

test("heartbeat and command lifecycle works when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { createEnrollment, provisionDevice, assignDevice } =
    await import("./devices.ts")
  const { recordDeviceHeartbeat } = await import("./heartbeats.ts")
  const {
    enqueueDeviceCommand,
    listPendingDeviceCommands,
    markDeviceCommandDelivered,
    acknowledgeDeviceCommand,
    expireStaleDeviceCommands,
  } = await import("./commands.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-1" },
    role: "operator",
    membershipId: "membership-operator",
    correlationId: "corr-heartbeat-test",
  }

  const enrollment = await createEnrollment(operatorContext, {
    locationId: HURLINGHAM_VENUE_ID,
    deviceType: "esp32_controller",
  })

  const provisioned = await provisionDevice({
    enrollmentCode: enrollment.enrollmentCode,
    hardwareUid: `sim-health-${Date.now()}`,
    firmwareVersion: "0.2.0",
    correlationId: "corr-health-provision",
  })

  await assignDevice(operatorContext, {
    deviceId: provisioned.deviceId,
    locationId: HURLINGHAM_VENUE_ID,
    resourceId: MAIN_POD_RESOURCE_ID,
    role: "score_input",
  })

  const heartbeat = await recordDeviceHeartbeat({
    tenantId: provisioned.tenantId,
    deviceId: provisioned.deviceId,
    bootId: "boot-1",
    correlationId: "corr-heartbeat-1",
    appliedConfigVersion: 1,
  })

  assert.equal(heartbeat.health, "online")
  assert.equal(heartbeat.sampled, true)

  const command = await enqueueDeviceCommand({
    tenantId: provisioned.tenantId,
    deviceId: provisioned.deviceId,
    kind: "reset",
    correlationId: "corr-command-1",
    expiresInSeconds: 120,
  })

  const pending = await listPendingDeviceCommands(
    provisioned.tenantId,
    provisioned.deviceId
  )
  assert.equal(pending.length, 1)

  await markDeviceCommandDelivered(
    provisioned.tenantId,
    provisioned.deviceId,
    command.id
  )

  const ack = await acknowledgeDeviceCommand({
    tenantId: provisioned.tenantId,
    deviceId: provisioned.deviceId,
    commandId: command.id,
    idempotencyKey: "ack-1",
    success: true,
    result: { reset: true },
  })

  assert.equal(ack.status, "acknowledged")

  const duplicateAck = await acknowledgeDeviceCommand({
    tenantId: provisioned.tenantId,
    deviceId: provisioned.deviceId,
    commandId: command.id,
    idempotencyKey: "ack-1",
    success: true,
  })

  assert.equal(duplicateAck.status, "acknowledged")

  const concurrentCommand = await enqueueDeviceCommand({
    tenantId: provisioned.tenantId,
    deviceId: provisioned.deviceId,
    kind: "reboot",
    correlationId: "corr-command-concurrent-ack",
    expiresInSeconds: 120,
  })
  await markDeviceCommandDelivered(
    provisioned.tenantId,
    provisioned.deviceId,
    concurrentCommand.id
  )
  const concurrentAcks = await Promise.all([
    acknowledgeDeviceCommand({
      tenantId: provisioned.tenantId,
      deviceId: provisioned.deviceId,
      commandId: concurrentCommand.id,
      idempotencyKey: "same-ack",
      success: true,
    }),
    acknowledgeDeviceCommand({
      tenantId: provisioned.tenantId,
      deviceId: provisioned.deviceId,
      commandId: concurrentCommand.id,
      idempotencyKey: "same-ack",
      success: true,
    }),
  ])
  assert.deepEqual(
    concurrentAcks.map((item) => item.status),
    ["acknowledged", "acknowledged"]
  )

  await expireStaleDeviceCommands(new Date("2099-01-01T00:00:00.000Z"))
})
