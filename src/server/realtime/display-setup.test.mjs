import assert from "node:assert/strict"
import test from "node:test"

import { groupDisplaySetupRows } from "./display-setup-group.ts"

test("tables are grouped per venue in natural order", () => {
  const row = (locationId, locationName, resourceId, resourceName) => ({
    locationId,
    locationName,
    resourceId,
    resourceName,
    resourceCode: null,
  })
  const venues = groupDisplaySetupRows([
    row("v1", "Hurlingham", "t2", "Table 2"),
    row("v1", "Hurlingham", "t10", "Table 10"),
    row("v1", "Hurlingham", "t1", "Table 1"),
    row("v2", "Westlands", "w1", "Table A"),
  ])

  assert.deepEqual(
    venues.map((venue) => [venue.name, venue.tables.map((table) => table.name)]),
    [
      ["Hurlingham", ["Table 1", "Table 2", "Table 10"]],
      ["Westlands", ["Table A"]],
    ],
  )
})
