import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { HURLINGHAM_VENUE_ID, MAIN_POD_RESOURCE_ID } from "../catalog/constants.ts"
import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const devicesRoot = import.meta.dirname

const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0015_devices.sql"),
  "utf8",
)

test("schema defines tenant-scoped device registry tables", () => {
  assert.match(schemaSource, /devices/)
  assert.match(schemaSource, /device_enrollments/)
  assert.match(schemaSource, /device_credentials/)
  assert.match(schemaSource, /device_assignments/)
  assert.match(schemaSource, /esp32_controller/)
  assert.match(schemaSource, /ttlock_lock/)
  assert.match(schemaSource, /ttlock_gateway/)
})

test("migration adds composite tenant foreign keys for device tables", () => {
  assert.match(migrationSource, /devices_tenant_location_fk/)
  assert.match(migrationSource, /device_credentials_tenant_device_fk/)
  assert.match(migrationSource, /device_assignments_tenant_device_fk/)
  assert.match(migrationSource, /device_assignments_device_open_unique/)
  assert.match(
    migrationSource,
    /device_assignments_scoring_resource_role_open_unique/,
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
    "utf8",
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
    "utf8",
  )
  const rotateRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/device/v1/credentials/rotate/route.ts",
    ),
    "utf8",
  )

  assert.match(configRoute, /requireDeviceRequest/)
  assert.match(rotateRoute, /requireDeviceRequest/)
  assert.doesNotMatch(configRoute, /getSessionWithBearerFallback/)
})

test("operator shell links to devices page", () => {
  const source = readFileSync(
    join(repoRoot, "src/components/operator/operator-shell.tsx"),
    "utf8",
  )
  assert.match(source, /\/operator\/devices/)
  assert.match(source, /Devices/)
})

test("enrollment provision and config flow works when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { createEnrollment, provisionDevice, getDeviceConfigForAuthenticatedDevice } =
    await import("./devices.ts")

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

  const { assignDevice, authenticateDeviceCredential } = await import("./devices.ts")

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

  const { DeviceError } = await import("./errors.ts")

  await assert.rejects(
    () =>
      provisionDevice({
        enrollmentCode: enrollment.enrollmentCode,
        hardwareUid: `sim-reuse-${Date.now()}`,
        correlationId: "corr-provision-reuse",
      }),
    DeviceError,
  )
})
