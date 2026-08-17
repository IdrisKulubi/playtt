import { and, asc, desc, eq, gt, gte, inArray, lt, ne, notInArray } from "drizzle-orm";

import db from "@/db/drizzle";
import {
  bookingStatusHistory,
  bookings,
  locations,
  resources,
  user,
} from "@/db/schema";
import { BOOKING_STATUSES_BLOCKING } from "@/server/bookings/constants";
import type {
  CreatePendingBookingInput,
  CreatePendingBookingResult,
  LocationSummary,
  ResourceSummary,
  UserBookingSummary,
} from "@/server/bookings/types";
import type { TenantContext } from "@/server/tenancy/types";

export type BookingListFilter = "all" | "upcoming" | "past";

function mapBookingRow(row: {
  id: string;
  status: string;
  paymentStatus: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  groupSize: number;
  currency: string;
  subtotalAmount: string;
  totalAmount: string;
  locationId: string;
  locationName: string;
  locationAddress: string;
  resourceId: string;
  resourceName: string;
  expiresAt: Date | null;
  notes: string | null;
}): UserBookingSummary {
  return {
    id: row.id,
    status: row.status,
    paymentStatus: row.paymentStatus,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    durationMinutes: row.durationMinutes,
    groupSize: row.groupSize,
    currency: row.currency,
    subtotalAmount: String(row.subtotalAmount),
    totalAmount: String(row.totalAmount),
    locationId: row.locationId,
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    resourceId: row.resourceId,
    resourceName: row.resourceName,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    notes: row.notes,
    editable: false,
    editBlockedReason: null,
  };
}

export async function listActiveLocationsWithResources(
  context: TenantContext,
): Promise<LocationSummary[]> {
  const rows = await db
    .select({
      locationId: locations.id,
      locationName: locations.name,
      locationSlug: locations.slug,
      locationTimezone: locations.timezone,
      locationAddress: locations.address,
      resourceId: resources.id,
      resourceName: resources.name,
      resourceSlug: resources.slug,
      resourceType: resources.type,
      resourceCapacity: resources.capacity,
    })
    .from(locations)
    .innerJoin(resources, eq(resources.locationId, locations.id))
    .where(
      and(
        eq(locations.tenantId, context.tenantId),
        eq(resources.tenantId, context.tenantId),
        eq(locations.isActive, true),
        eq(resources.isActive, true),
      ),
    )
    .orderBy(asc(locations.name), asc(resources.sortOrder), asc(resources.name));

  const map = new Map<string, LocationSummary>();

  for (const row of rows) {
    const existing = map.get(row.locationId);
    const resource: ResourceSummary = {
      id: row.resourceId,
      locationId: row.locationId,
      name: row.resourceName,
      slug: row.resourceSlug,
      type: row.resourceType,
      capacity: row.resourceCapacity,
    };

    if (existing) {
      existing.resources.push(resource);
      continue;
    }

    map.set(row.locationId, {
      id: row.locationId,
      name: row.locationName,
      slug: row.locationSlug,
      timezone: row.locationTimezone,
      address: row.locationAddress,
      resources: [resource],
    });
  }

  return Array.from(map.values());
}

export async function getResourceContext(
  context: TenantContext,
  input: {
    locationId: string;
    resourceId: string;
  },
) {
  const [row] = await db
    .select({
      locationId: locations.id,
      locationName: locations.name,
      timezone: locations.timezone,
      resourceId: resources.id,
      resourceName: resources.name,
    })
    .from(resources)
    .innerJoin(locations, eq(resources.locationId, locations.id))
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(locations.tenantId, context.tenantId),
        eq(resources.id, input.resourceId),
        eq(resources.locationId, input.locationId),
        eq(resources.isActive, true),
        eq(locations.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function listActiveResourcesByLocation(
  context: TenantContext,
  locationId: string,
) {
  return db
    .select({
      id: resources.id,
      locationId: resources.locationId,
      name: resources.name,
      slug: resources.slug,
      type: resources.type,
      capacity: resources.capacity,
    })
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(resources.locationId, locationId),
        eq(resources.isActive, true),
      ),
    )
    .orderBy(asc(resources.sortOrder), asc(resources.name));
}

export async function ensureUserExists(userId: string) {
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return existingUser ?? null;
}

export async function findBlockingBookings(
  context: TenantContext,
  input: {
    resourceId: string;
    start: Date;
    end: Date;
    excludeBookingId?: string;
  },
) {
  return db
    .select({
      id: bookings.id,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.resourceId, input.resourceId),
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        lt(bookings.startTime, input.end),
        gt(bookings.endTime, input.start),
        input.excludeBookingId
          ? ne(bookings.id, input.excludeBookingId)
          : undefined,
      ),
    );
}

export async function findBlockingBookingsForResources(
  context: TenantContext,
  input: {
    resourceIds: string[];
    start: Date;
    end: Date;
    excludeBookingId?: string;
  },
) {
  if (input.resourceIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: bookings.id,
      resourceId: bookings.resourceId,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        inArray(bookings.resourceId, input.resourceIds),
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        lt(bookings.startTime, input.end),
        gt(bookings.endTime, input.start),
        input.excludeBookingId
          ? ne(bookings.id, input.excludeBookingId)
          : undefined,
      ),
    );
}

export async function listUserBookings(
  context: TenantContext,
  input: {
    userId: string;
    filter?: BookingListFilter;
  },
): Promise<UserBookingSummary[]> {
  const now = new Date();
  const filter = input.filter ?? "all";

  const timeCondition =
    filter === "upcoming"
      ? gte(bookings.endTime, now)
      : filter === "past"
        ? lt(bookings.endTime, now)
        : undefined;

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      durationMinutes: bookings.durationMinutes,
      groupSize: bookings.groupSize,
      currency: bookings.currency,
      subtotalAmount: bookings.subtotalAmount,
      totalAmount: bookings.totalAmount,
      locationId: bookings.locationId,
      locationName: locations.name,
      locationAddress: locations.address,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      expiresAt: bookings.expiresAt,
      notes: bookings.notes,
    })
    .from(bookings)
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(locations.tenantId, context.tenantId),
        eq(resources.tenantId, context.tenantId),
        eq(bookings.userId, input.userId),
        timeCondition,
        notInArray(bookings.status, ["expired", "cancelled"]),
      ),
    )
    .orderBy(
      filter === "past" ? desc(bookings.startTime) : asc(bookings.startTime),
    );

  return rows.map(mapBookingRow);
}

export async function getUserBookingById(
  context: TenantContext,
  input: {
    userId: string;
    bookingId: string;
  },
): Promise<UserBookingSummary | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      durationMinutes: bookings.durationMinutes,
      groupSize: bookings.groupSize,
      currency: bookings.currency,
      subtotalAmount: bookings.subtotalAmount,
      totalAmount: bookings.totalAmount,
      locationId: bookings.locationId,
      locationName: locations.name,
      locationAddress: locations.address,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      expiresAt: bookings.expiresAt,
      notes: bookings.notes,
    })
    .from(bookings)
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(locations.tenantId, context.tenantId),
        eq(resources.tenantId, context.tenantId),
        eq(bookings.id, input.bookingId),
        eq(bookings.userId, input.userId),
      ),
    )
    .limit(1);

  return row ? mapBookingRow(row) : null;
}

export async function insertPendingBooking(
  context: TenantContext,
  input: {
    booking: CreatePendingBookingInput & {
      start: Date;
      end: Date;
      currency: string;
      subtotalAmount: string;
      discountAmount: string;
      totalAmount: string;
      pricingRuleSnapshot: Record<string, unknown>;
      expiresAt: Date;
    };
  },
): Promise<CreatePendingBookingResult> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bookings)
      .values({
        tenantId: context.tenantId,
        locationId: input.booking.locationId,
        resourceId: input.booking.resourceId,
        userId: input.booking.userId,
        status: "pending",
        paymentStatus: "unpaid",
        startTime: input.booking.start,
        endTime: input.booking.end,
        durationMinutes: input.booking.durationMinutes,
        groupSize: input.booking.groupSize,
        currency: input.booking.currency,
        subtotalAmount: input.booking.subtotalAmount,
        discountAmount: input.booking.discountAmount,
        totalAmount: input.booking.totalAmount,
        pricingRuleSnapshot: input.booking.pricingRuleSnapshot,
        notes: input.booking.notes,
        expiresAt: input.booking.expiresAt,
      })
      .returning({
        id: bookings.id,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        totalAmount: bookings.totalAmount,
        currency: bookings.currency,
        expiresAt: bookings.expiresAt,
      });

    await tx.insert(bookingStatusHistory).values({
      tenantId: context.tenantId,
      bookingId: created.id,
      fromStatus: null,
      toStatus: "pending",
      reason: "booking_created",
      metadata: {
        source: "api_bookings_create",
      },
    });

    return {
      bookingId: created.id,
      status: created.status,
      paymentStatus: created.paymentStatus,
      totalAmount: String(created.totalAmount),
      currency: created.currency,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    };
  });
}
