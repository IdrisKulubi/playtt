import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8")
const route = readFileSync(
  new URL("../../app/api/activity/stats/route.ts", import.meta.url),
  "utf8"
)
test("booking and payment query enforce authenticated user and tenant independently", () => {
  assert.match(service, /eq\(bookings\.userId, userId\)/)
  assert.match(service, /eq\(bookings\.tenantId, context\.tenantId\)/)
  assert.match(service, /p\.user_id = \$\{userId\}/)
  assert.match(service, /p\.tenant_id = \$\{context\.tenantId\}/)
  assert.match(service, /eq\(locations\.tenantId, context\.tenantId\)/)
  assert.match(service, /eq\(resources\.tenantId, context\.tenantId\)/)
})
test("payments are correlated per booking, exclude failed retries and fully refunded payments", () => {
  assert.match(service, /select sum\(p\.amount\)/)
  assert.match(service, /p\.booking_id = \$\{bookings\.id\}/)
  assert.match(service, /p\.status in \('paid', 'partially_refunded'\)/)
  assert.doesNotMatch(service, /\.innerJoin\(payments/)
})
test("endpoint authenticates, validates range, avoids shared caches and conceals unexpected database errors", () => {
  assert.match(route, /getSessionWithBearerFallback\(req\)/)
  assert.match(route, /if \(!session\)/)
  assert.match(route, /userId: session\.user\.id/)
  assert.match(route, /activityRange\(period as ActivityPeriod, date\)/)
  assert.match(route, /private, no-store/)
  assert.match(route, /error instanceof TenancyError/)
  assert.match(route, /Could not load your activity/)
})
