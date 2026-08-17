import assert from "node:assert/strict"
import test from "node:test"

import { mapLocationToVenue } from "./map-venue.mjs"
import { HURLINGHAM_VENUE_ID } from "./constants.ts"

test("mapLocationToVenue maps location id to venueId", () => {
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
  assert.equal(venue.brandId, "44444444-4444-4444-4444-444444444444")
  assert.equal(venue.settings?.gracePeriodMinutes, 5)
  assert.equal(venue.archivedAt, null)
})

test("mapLocationToVenue preserves archivedAt for archived venues", () => {
  const archivedAt = new Date("2026-01-01T00:00:00.000Z")
  const venue = mapLocationToVenue({
    id: HURLINGHAM_VENUE_ID,
    tenantId: null,
    brandId: null,
    name: "Archived Venue",
    slug: "archived",
    address: "Somewhere",
    timezone: "Africa/Nairobi",
    isActive: false,
    settings: null,
    archivedAt,
    notes: null,
  })

  assert.equal(venue.archivedAt, archivedAt)
  assert.equal(venue.isActive, false)
})
