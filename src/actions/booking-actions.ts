"use server";

import { headers } from "next/headers";

import { auth } from "../../auth";
import {
  createPendingBooking,
  getBookingBootstrapData,
  getBookingQuote,
  getLocationAvailability,
} from "@/server/bookings/service";
import { getUserProfileById } from "@/server/users/onboarding";
import {
  coordinatePendingBookingCreation,
  type PendingBookingActionInput,
} from "@/actions/create-pending-booking-coordinator";
import { createCorrelationId } from "@/server/tenancy/correlation";
import {
  resolvePublicCatalogContext,
  resolveTenantContextFromWebSession,
} from "@/server/tenancy/session-context";

export async function getBookingBootstrapAction() {
  try {
    const context = await resolvePublicCatalogContext();
    const data = await getBookingBootstrapData(context);
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
    const context = await resolvePublicCatalogContext();
    const data = await getLocationAvailability(context, input);
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
    const context = await resolvePublicCatalogContext();
    const data = await getBookingQuote(context, input);
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to calculate quote.",
    };
  }
}

export async function createPendingBookingAction(
  input: PendingBookingActionInput,
) {
  return coordinatePendingBookingCreation(input, {
    createBooking: async (bookingInput) => {
      const context = await resolveTenantContextFromWebSession();
      return createPendingBooking(context, bookingInput);
    },
    getProfile: getUserProfileById,
    getSession: async () =>
      auth.api.getSession({ headers: await headers() }),
  });
}
