import { and, eq, gte, lt, sql } from "drizzle-orm"
import db from "@/db/drizzle"
import { bookings, locations, payments, resources } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"
import {
  activityRange,
  aggregateActivity,
  type ActivityPeriod,
} from "./aggregate"

export async function getPlayerActivity(
  context: TenantContext,
  userId: string,
  period: ActivityPeriod,
  date: string
) {
  const range = activityRange(period, date)
  // Correlated payment aggregate avoids multiplying bookings when a booking has retries or upgrades.
  const rows = await db
    .select({
      id: bookings.id,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      durationMinutes: bookings.durationMinutes,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      currency: bookings.currency,
      locationName: locations.name,
      resourceName: resources.name,
      totalKes: sql<number>`cast(${bookings.totalAmount} as double precision)`,
      spendKes: sql<number>`cast(coalesce((select sum(p.amount) from ${payments} p where p.booking_id = ${bookings.id} and p.user_id = ${userId} and p.tenant_id = ${context.tenantId} and p.currency = 'KES' and p.status in ('paid', 'partially_refunded')), 0) as double precision)`,
    })
    .from(bookings)
    .innerJoin(
      locations,
      and(
        eq(locations.id, bookings.locationId),
        eq(locations.tenantId, context.tenantId)
      )
    )
    .innerJoin(
      resources,
      and(
        eq(resources.id, bookings.resourceId),
        eq(resources.tenantId, context.tenantId)
      )
    )
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.tenantId, context.tenantId),
        gte(bookings.startTime, range.previousStart),
        lt(bookings.startTime, range.end)
      )
    )
  return aggregateActivity(rows, period, date)
}
