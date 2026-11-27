import { and, asc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { locations, resources } from "@/db/schema"

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

export async function listDisplaySetupVenues(): Promise<DisplaySetupVenue[]> {
  const rows = await db
    .select({
      locationId: locations.id,
      locationName: locations.name,
      resourceId: resources.id,
      resourceName: resources.name,
      resourceCode: resources.code,
    })
    .from(resources)
    .innerJoin(locations, eq(resources.locationId, locations.id))
    .where(and(eq(resources.isActive, true), eq(locations.isActive, true)))
    .orderBy(asc(locations.name), asc(resources.sortOrder), asc(resources.name))

  return groupDisplaySetupRows(rows)
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
  return [...venues.values()]
}
