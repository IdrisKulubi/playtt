import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { PUBLIC_VENUE_API_FLAG_KEY } from "./access.mjs"
import { mapLocationToVenue } from "./map-venue.mjs"
import { HURLINGHAM_VENUE_ID } from "./constants.ts"

const repoRoot = join(import.meta.dirname, "../../..")
const catalogRoot = import.meta.dirname

test("public venue API flag key is stable", () => {
  assert.equal(PUBLIC_VENUE_API_FLAG_KEY, "public_venue_api")
})

test("versioned venue adapters map location id to venueId without renaming the table", () => {
  const venue = mapLocationToVenue({
    id: HURLINGHAM_VENUE_ID,
    tenantId: "33333333-3333-3333-3333-333333333333",
    brandId: "44444444-4444-4444-4444-444444444444",
    name: "PlayTT Hurlingham",
    slug: "playtt-hurlingham",
    address: "Hurlingham, Nairobi, Kenya",
    timezone: "Africa/Nairobi",
    isActive: true,
    settings: { gracePeriodMinutes: 5 },
    archivedAt: null,
    notes: null,
  })

  assert.equal(venue.venueId, HURLINGHAM_VENUE_ID)
  assert.equal(venue.tenantId, "33333333-3333-3333-3333-333333333333")
})

test("catalog repository scopes public venue queries by tenant context", () => {
  const source = readFileSync(join(catalogRoot, "repository.ts"), "utf8")
  assert.match(source, /eq\(locations\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(resources\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(resourceCapabilities\.tenantId, context\.tenantId\)/)
})

test("versioned venue routes reject client tenant identifiers and use PlayTT public context", () => {
  const requestHelper = readFileSync(join(catalogRoot, "public-request.ts"), "utf8")
  assert.match(requestHelper, /rejectClientTenantId/)
  assert.match(requestHelper, /x-tenant-id/)
  assert.match(requestHelper, /tenantId/)
  assert.match(requestHelper, /resolvePublicCatalogContext/)
  assert.match(requestHelper, /isPublicVenueApiEnabledForTenant/)
})

test("legacy booking bootstrap keeps location IDs and omits tenant payload fields", () => {
  const bootstrapFixture = JSON.parse(
    readFileSync(
      join(repoRoot, "contracts/mobile-api/fixtures/bookings.bootstrap.get.success.json"),
      "utf8",
    ),
  )
  const location = bootstrapFixture.response.body.data.locations[0]

  assert.equal(typeof location.id, "string")
  assert.equal(location.venueId, undefined)
  assert.equal(location.tenantId, undefined)
  assert.equal(typeof location.resources[0].id, "string")
  assert.equal(location.resources[0].resourceId, undefined)
  assert.equal(location.resources[0].capabilities, undefined)

  const locationSummary = readFileSync(
    join(repoRoot, "src/server/bookings/types.ts"),
    "utf8",
  )
  assert.match(locationSummary, /export interface LocationSummary/)
  assert.doesNotMatch(
    locationSummary.slice(
      locationSummary.indexOf("export interface LocationSummary"),
      locationSummary.indexOf("export interface ResourceSummary"),
    ),
    /tenantId/,
  )
})

test("legacy booking routes still resolve PlayTT public context without a tenant field", () => {
  for (const fileName of ["bootstrap", "quote", "availability"]) {
    const source = readFileSync(
      join(repoRoot, "src/app/api/bookings", fileName, "route.ts"),
      "utf8",
    )
    assert.match(source, /resolvePublicCatalogContext/)
    assert.doesNotMatch(source, /tenantId/)
  }
})
