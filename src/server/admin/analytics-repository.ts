import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  bookingStatusEnum,
  devices,
  locations,
  payments,
  playSessions,
  resources,
  tenantMemberships,
  user,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

export interface AdminOverviewMetrics {
  todayBookings: number
  activeSessions: number
  revenueLast7Days: number
  revenueLast30Days: number
  activeDevices: number
  pendingDevices: number
  venueCount: number
  memberCount: number
  totalActiveResources: number
}

export interface AdminBookingRow {
  id: string
  locationId: string
  locationName: string
  resourceId: string
  resourceName: string
  userId: string
  userName: string
  userEmail: string
  status: string
  paymentStatus: string
  startTime: string
  endTime: string
  totalAmount: string
  currency: string
}

export interface AdminRevenueByVenue {
  locationId: string
  locationName: string
  totalAmount: string
  paymentCount: number
}

export interface AdminRevenueByDay {
  day: string
  totalAmount: string
  paymentCount: number
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

export async function getAdminOverviewMetrics(
  context: TenantContext,
): Promise<AdminOverviewMetrics> {
  const todayStart = startOfDay(new Date())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const [todayBookingsRow] = await db
    .select({ value: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        gte(bookings.startTime, todayStart),
        lte(bookings.startTime, tomorrowStart),
        eq(bookings.status, "confirmed"),
      ),
    )

  const [activeSessionsRow] = await db
    .select({ value: count() })
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.status, "active"),
      ),
    )

  const revenue7 = await sumPaidRevenueSince(context, daysAgo(7))
  const revenue30 = await sumPaidRevenueSince(context, daysAgo(30))

  const [activeDevicesRow] = await db
    .select({ value: count() })
    .from(devices)
    .where(
      and(eq(devices.tenantId, context.tenantId), eq(devices.status, "active")),
    )

  const [pendingDevicesRow] = await db
    .select({ value: count() })
    .from(devices)
    .where(
      and(eq(devices.tenantId, context.tenantId), eq(devices.status, "pending")),
    )

  const [venueCountRow] = await db
    .select({ value: count() })
    .from(locations)
    .where(eq(locations.tenantId, context.tenantId))

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, context.tenantId))

  const [totalActiveResourcesRow] = await db
    .select({ value: count() })
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(resources.isActive, true),
      ),
    )

  return {
    todayBookings: Number(todayBookingsRow?.value ?? 0),
    activeSessions: Number(activeSessionsRow?.value ?? 0),
    revenueLast7Days: revenue7,
    revenueLast30Days: revenue30,
    activeDevices: Number(activeDevicesRow?.value ?? 0),
    pendingDevices: Number(pendingDevicesRow?.value ?? 0),
    venueCount: Number(venueCountRow?.value ?? 0),
    memberCount: Number(memberCountRow?.value ?? 0),
    totalActiveResources: Number(totalActiveResourcesRow?.value ?? 0),
  }
}

async function sumPaidRevenueSince(context: TenantContext, since: Date) {
  const [row] = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, context.tenantId),
        eq(payments.status, "paid"),
        gte(payments.paidAt, since),
      ),
    )

  return Number(row?.total ?? 0)
}

export async function listAdminBookings(
  context: TenantContext,
  filters?: {
    locationId?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  },
): Promise<AdminBookingRow[]> {
  const conditions = [eq(bookings.tenantId, context.tenantId)]

  if (filters?.locationId) {
    conditions.push(eq(bookings.locationId, filters.locationId))
  }

  if (filters?.status) {
    conditions.push(
      eq(
        bookings.status,
        filters.status as (typeof bookingStatusEnum.enumValues)[number],
      ),
    )
  }

  if (filters?.from) {
    conditions.push(gte(bookings.startTime, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(bookings.startTime, filters.to))
  }

  const rows = await db
    .select({
      booking: bookings,
      locationName: locations.name,
      resourceName: resources.name,
      userName: user.name,
      userEmail: user.email,
    })
    .from(bookings)
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .innerJoin(user, eq(bookings.userId, user.id))
    .where(and(...conditions))
    .orderBy(sql`${bookings.startTime} desc`)
    .limit(filters?.limit ?? 100)

  return rows.map((row) => ({
    id: row.booking.id,
    locationId: row.booking.locationId,
    locationName: row.locationName,
    resourceId: row.booking.resourceId,
    resourceName: row.resourceName,
    userId: row.booking.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    status: row.booking.status,
    paymentStatus: row.booking.paymentStatus,
    startTime: row.booking.startTime.toISOString(),
    endTime: row.booking.endTime.toISOString(),
    totalAmount: row.booking.totalAmount,
    currency: row.booking.currency,
  }))
}

export async function getRevenueByVenue(
  context: TenantContext,
  since?: Date,
): Promise<AdminRevenueByVenue[]> {
  const conditions = [
    eq(payments.tenantId, context.tenantId),
    eq(payments.status, "paid"),
  ]

  if (since) {
    conditions.push(gte(payments.paidAt, since))
  }

  const rows = await db
    .select({
      locationId: payments.locationId,
      locationName: locations.name,
      totalAmount: sum(payments.amount),
      paymentCount: count(),
    })
    .from(payments)
    .innerJoin(locations, eq(payments.locationId, locations.id))
    .where(and(...conditions))
    .groupBy(payments.locationId, locations.name)
    .orderBy(locations.name)

  return rows.map((row) => ({
    locationId: row.locationId,
    locationName: row.locationName,
    totalAmount: String(row.totalAmount ?? 0),
    paymentCount: Number(row.paymentCount ?? 0),
  }))
}

export async function getRevenueByDay(
  context: TenantContext,
  days = 30,
): Promise<AdminRevenueByDay[]> {
  const since = daysAgo(days)

  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${payments.paidAt})::date::text`,
      totalAmount: sum(payments.amount),
      paymentCount: count(),
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, context.tenantId),
        eq(payments.status, "paid"),
        gte(payments.paidAt, since),
      ),
    )
    .groupBy(sql`date_trunc('day', ${payments.paidAt})::date`)
    .orderBy(sql`date_trunc('day', ${payments.paidAt})::date`)

  return rows.map((row) => ({
    day: row.day,
    totalAmount: String(row.totalAmount ?? 0),
    paymentCount: Number(row.paymentCount ?? 0),
  }))
}
