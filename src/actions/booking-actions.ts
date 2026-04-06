"use server";

import {
  createPendingBooking,
  getBookingBootstrapData,
  getBookingQuote,
  getLocationAvailability,
} from "@/server/bookings/service";

export async function getBookingBootstrapAction() {
  try {
    const data = await getBookingBootstrapData();
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load booking setup.",
    };
  }
}

export async function getAvailabilityAction(input: {
  locationId: string;
  date: string;
  durationMinutes: 30 | 60;
  groupSize: 2 | 3 | 4 | 5 | 6 | 7 | 8;
}) {
  try {
    const data = await getLocationAvailability(input);
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load availability.",
    };
  }
}

export async function getBookingQuoteAction(input: {
  locationId: string;
  resourceId: string;
  startTimeIso: string;
  durationMinutes: 30 | 60;
  groupSize: 2 | 3 | 4 | 5 | 6 | 7 | 8;
}) {
  try {
    const data = await getBookingQuote(input);
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to calculate quote.",
    };
  }
}

export async function createPendingBookingAction(input: {
  userId: string;
  locationId: string;
  resourceId: string;
  startTimeIso: string;
  durationMinutes: 30 | 60;
  groupSize: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  notes?: string;
}) {
  try {
    const data = await createPendingBooking(input);
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create pending booking.",
    };
  }
}
