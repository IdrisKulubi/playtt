import assert from "node:assert/strict"
import test from "node:test"

import { SimulatedRelayProvider } from "./relay-providers.ts"

test("relay simulator rejects expired commands", async () => {
  const relay = new SimulatedRelayProvider()
  await assert.rejects(
    () =>
      relay.execute({
        tenantId: "tenant-1",
        venueId: "venue-1",
        resourceId: "resource-1",
        playSessionId: "session-1",
        correlationId: "correlation-1",
        channel: "table_lights",
        desiredState: "on",
        expiresAt: new Date(0),
        idempotencyKey: "relay:expired",
      }),
    /expired/,
  )
})
