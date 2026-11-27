import { and, asc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { locations, resources } from "@/db/schema"
import {
  groupDisplaySetupRows,
  type DisplaySetupVenue,
} from "@/server/realtime/display-setup-group"

export type { DisplaySetupVenue }

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
