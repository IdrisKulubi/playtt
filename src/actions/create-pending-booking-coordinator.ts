export type PendingBookingActionInput = {
  durationMinutes: 30 | 60
  groupSize: 2 | 3 | 4 | 5 | 6 | 7 | 8
  locationId: string
  notes?: string
  resourceId: string
  startTimeIso: string
}

type CreatePendingBookingInput = PendingBookingActionInput & {
  userId: string
}

type CoordinatorDependencies<T> = {
  createBooking: (input: CreatePendingBookingInput) => Promise<T>
  getProfile: (
    userId: string,
  ) => Promise<{ onboardingCompletedAt?: unknown } | null | undefined>
  getSession: () => Promise<
    { user?: { id?: string } | null } | null | undefined
  >
}

export async function coordinatePendingBookingCreation<T>(
  input: PendingBookingActionInput,
  dependencies: CoordinatorDependencies<T>,
) {
  try {
    const session = await dependencies.getSession()
    const userId = session?.user?.id

    if (!userId) {
      return { success: false as const, message: "Sign in is required." }
    }

    const profile = await dependencies.getProfile(userId)

    if (!profile?.onboardingCompletedAt) {
      return {
        success: false as const,
        message: "Complete your player profile before booking.",
      }
    }

    const data = await dependencies.createBooking({
      durationMinutes: input.durationMinutes,
      groupSize: input.groupSize,
      locationId: input.locationId,
      notes: input.notes,
      resourceId: input.resourceId,
      startTimeIso: input.startTimeIso,
      userId,
    })

    return { success: true as const, data }
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create pending booking.",
    }
  }
}
