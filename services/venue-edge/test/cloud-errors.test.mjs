import assert from "node:assert/strict"
import test from "node:test"

import { isDeviceRevokedCloudError } from "../src/auth/cloud-errors.ts"
import { EdgeProtocolError } from "../src/cloud/client.ts"

test("cloud identity removal invalidates local enrollment", () => {
  assert.equal(
    isDeviceRevokedCloudError(
      new EdgeProtocolError("DEVICE_REVOKED", "revoked", 403),
    ),
    true,
  )
  assert.equal(
    isDeviceRevokedCloudError(
      new EdgeProtocolError("DEVICE_UNAUTHENTICATED", "deleted", 401),
    ),
    true,
  )
  assert.equal(
    isDeviceRevokedCloudError(
      new EdgeProtocolError("DEVICE_NOT_FOUND", "deleted", 404),
    ),
    true,
  )
})

test("temporary cloud failures do not erase local identity", () => {
  assert.equal(
    isDeviceRevokedCloudError(
      new EdgeProtocolError("NETWORK_ERROR", "offline", 0),
    ),
    false,
  )
})
