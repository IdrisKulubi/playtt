import assert from "node:assert/strict"
import test from "node:test"

import {
  BOOKING_ACCESS_STATES,
  bookingAccessNoStoreHeaders,
} from "./player-contract.ts"

test("player access contract exposes every planned state", () => {
  assert.deepEqual(BOOKING_ACCESS_STATES, [
    "configuring",
    "ready",
    "temporarily_unavailable",
    "action_required",
    "revoking",
    "revoked",
    "expired",
    "not_eligible",
  ])
})

test("access responses cannot be stored by browsers or shared caches", () => {
  const headers = bookingAccessNoStoreHeaders()
  assert.match(headers["Cache-Control"], /no-store/)
  assert.match(headers.Vary, /Authorization/)
  assert.match(headers.Vary, /x-tenant-id/)
})
