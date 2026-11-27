/**
 * What a venue TV shows on its one-time setup screen: active venues and
 * their active tables, so the TV can be pointed at a table with the remote.
 * Names only (the same ones the public booking pages show), nothing else.
 */
export interface DisplaySetupVenue {
  id: string
  name: string
  tables: Array<{ id: string; name: string; code: string | null }>
}

export function groupDisplaySetupRows(
  rows: Array<{
    locationId: string
    locationName: string
    resourceId: string
    resourceName: string
    resourceCode: string | null
  }>
): DisplaySetupVenue[] {
  const venues = new Map<string, DisplaySetupVenue>()
  for (const row of rows) {
    let venue = venues.get(row.locationId)
    if (!venue) {
      venue = { id: row.locationId, name: row.locationName, tables: [] }
      venues.set(row.locationId, venue)
    }
    venue.tables.push({
      id: row.resourceId,
      name: row.resourceName,
      code: row.resourceCode,
    })
  }
  // Natural order on the TV ("Table 2" before "Table 10"), whatever the
  // booking pages' sort order is.
  const naturalOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" })
  for (const venue of venues.values()) {
    venue.tables.sort((left, right) => naturalOrder.compare(left.name, right.name))
  }
  return [...venues.values()]
}
