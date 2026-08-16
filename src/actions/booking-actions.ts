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
  locationId: string;
  resourceId: string;
  startTimeIso: string;
  durationMinutes: 30 | 60;
  groupSize: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  notes?: string;
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return { success: false as const, message: "Sign in is required." };
    }

    const profile = await getUserProfileById(session.user.id);

    if (!profile?.onboardingCompletedAt) {
      return {
        success: false as const,
        message: "Complete your player profile before booking.",
      };
    }

    const data = await createPendingBooking({
      ...input,
      userId: session.user.id,
    });
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
