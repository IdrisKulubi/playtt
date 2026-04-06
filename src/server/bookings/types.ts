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
