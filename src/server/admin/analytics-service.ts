import {
  getAdminOverviewMetrics,
  getRevenueByDay,
  getRevenueByVenue,
  listAdminBookings,
  type AdminBookingRow,
  type AdminOverviewMetrics,
  type AdminRevenueByDay,
  type AdminRevenueByVenue,
} from "@/server/admin/analytics-repository"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export type {
  AdminBookingRow,
  AdminOverviewMetrics,
  AdminRevenueByDay,
  AdminRevenueByVenue,
}

export async function getOverviewForAdmin(context: TenantContext) {
  authorize(context, "analytics.read")
  return getAdminOverviewMetrics(context)
}

export async function listBookingsForAdmin(
  context: TenantContext,
  filters?: {
    locationId?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  },
) {
  authorize(context, "analytics.read")
  return listAdminBookings(context, filters)
}

export async function getRevenueByVenueForAdmin(
  context: TenantContext,
  since?: Date,
) {
  authorize(context, "analytics.read")
  return getRevenueByVenue(context, since)
}

export async function getRevenueByDayForAdmin(context: TenantContext, days = 30) {
  authorize(context, "analytics.read")
  return getRevenueByDay(context, days)
}
