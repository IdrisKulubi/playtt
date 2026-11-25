export interface LocationSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  address: string;
  resources: ResourceSummary[];
}

export interface ResourceSummary {
  id: string;
  locationId: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
}

export interface SlotAvailability {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isAvailable: boolean;
  openTableCount: number;
  availableResourceIds: string[];
  /** True for the "soonest" start added for today (e.g. 11:50 at 11:47). */
  isEarliest?: boolean;
  price: {
    currency: string;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    pricingRuleSnapshot: Record<string, unknown>;
  };
}

export interface BookingQuote {
  locationId: string;
  resourceId: string;
  groupSize: number;
  durationMinutes: number;
  startTimeIso: string;
  endTimeIso: string;
  currency: string;
  subtotalAmount: number;
  surchargeAmount: number;
  discountAmount: number;
  totalAmount: number;
  pricingRuleSnapshot: Record<string, unknown>;
}

export interface CreatePendingBookingInput {
  userId: string;
  locationId: string;
  resourceId: string;
  startTimeIso: string;
  durationMinutes: number;
  groupSize: number;
  notes?: string;
}

export interface CreatePendingBookingResult {
  bookingId: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  currency: string;
  expiresAt: string | null;
}

export interface PlaySessionProjection {
  id: string;
  status: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

export interface UserBookingSummary {
  id: string;
  status: string;
  paymentStatus: string;
  startTime: string;
  endTime: string;
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
  expiresAt: string | null;
  notes: string | null;
  editable: boolean;
  editBlockedReason: string | null;
  playSession: PlaySessionProjection | null;
}

export interface SlotPrice {
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  pricingRuleSnapshot: Record<string, unknown>;
}

export type BookingSuggestionKind = "later" | "earlier" | "shorter";

export interface BookingSuggestion {
  kind: BookingSuggestionKind;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  /** Minutes moved from the requested start (negative = earlier). */
  shiftMinutes: number;
  resourceId: string;
  price: SlotPrice;
}

/**
 * Answer to "can I play at this time?". When the time is free it names the
 * table; when it clashes it says when the table is busy (never who booked it)
 * and offers the closest times that work.
 */
export interface BookingPlan {
  status: "available" | "conflict" | "past";
  requested: {
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
  };
  resourceId: string | null;
  price: SlotPrice | null;
  /** Busy times on the tables that clash with the request. */
  conflicts: { startsAt: string; endsAt: string }[];
  suggestions: BookingSuggestion[];
  /** Soonest bookable start right now, so clients can correct a past time. */
  earliestStartIso: string;
}
