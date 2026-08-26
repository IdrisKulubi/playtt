import assert from "node:assert/strict"
import test from "node:test"

import { NOTIFICATION_TEMPLATE_COPY } from "./contract.ts"

test("push notification templates never mention passcodes", () => {
  for (const [key, copy] of Object.entries(NOTIFICATION_TEMPLATE_COPY)) {
    assert.match(copy.title.toLowerCase(), /^(?!.*\bcode\b).*/)
    assert.match(copy.body().toLowerCase(), /^(?!.*\b\d{8}\b).*/)
    assert.doesNotMatch(copy.body().toLowerCase(), /passcode|pin|keyboard/)
    assert.ok(key.length > 0)
  }
})
