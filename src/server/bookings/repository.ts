import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";

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
} from "@/server/bookings/types";

export async function listActiveLocationsWithResources(): Promise<LocationSummary[]> {
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
    .where(and(eq(locations.isActive, true), eq(resources.isActive, true)))
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

export async function getResourceContext(input: {
  locationId: string;
  resourceId: string;
}) {
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
        eq(resources.id, input.resourceId),
        eq(resources.locationId, input.locationId),
        eq(resources.isActive, true),
        eq(locations.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function listActiveResourcesByLocation(locationId: string) {
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
    .where(and(eq(resources.locationId, locationId), eq(resources.isActive, true)))
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

export async function findBlockingBookings(input: {
  resourceId: string;
  start: Date;
  end: Date;
}) {
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
        eq(bookings.resourceId, input.resourceId),
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        lt(bookings.startTime, input.end),
        gt(bookings.endTime, input.start),
      ),
    );
}

export async function findBlockingBookingsForResources(input: {
  resourceIds: string[];
  start: Date;
  end: Date;
}) {
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
        inArray(bookings.resourceId, input.resourceIds),
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        lt(bookings.startTime, input.end),
        gt(bookings.endTime, input.start),
      ),
    );
}

export async function insertPendingBooking(input: {
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
}): Promise<CreatePendingBookingResult> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bookings)
      .values({
        locationId: input.booking.locationId,
        resourceId: input.booking.resourceId,
        userId: input.booking.userId,
        status: "pending",
        paymentStatus: "unpaid",
        startTime: input.booking.start,
        endTime: input.booking.end,
        durationMinutes: input.booking.durationMinutes,
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
      bookingId: created.id,
      fromStatus: null,
      toStatus: "pending",
      reason: "booking_created",
      metadata: {
        source: "phase_2_booking_action",
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
