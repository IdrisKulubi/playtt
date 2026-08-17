import type { TenantContext } from "@/server/tenancy/types"

export type OwnedOperationResult<T> =
  | { authenticated: false }
  | { authenticated: true; value: T }

type ActorDependencies = {
  getActorId: () => Promise<string | null>
  resolveContext?: (userId: string) => Promise<TenantContext>
}

async function coordinateOwnedOperation<T>(
  dependencies: ActorDependencies,
  operation: (input: { userId: string; context: TenantContext }) => Promise<T>,
): Promise<OwnedOperationResult<T>> {
  const actorId = await dependencies.getActorId()

  if (!actorId) {
    return { authenticated: false }
  }

  const context = dependencies.resolveContext
    ? await dependencies.resolveContext(actorId)
    : await (
        await import("../tenancy/resolve-user-context")
      ).resolveTenantContextForUserId(actorId)

  return {
    authenticated: true,
    value: await operation({ userId: actorId, context }),
  }
}

type BookingIdentifiers = {
  bookingId: string
}

type ModificationIdentifiers = BookingIdentifiers & {
  modificationId: string
}

export function coordinateBookingDetail<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    getBooking: (input: BookingIdentifiers & {
      userId: string
      context: TenantContext
    }) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.getBooking({ bookingId, userId, context })
  })
}

export function coordinateBookingPaymentStart<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<unknown>
    startPayment: (
      input: BookingIdentifiers & {
        userId: string
        context: TenantContext
        body: unknown
      },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.startPayment({ bookingId, userId, context, body })
  })
}

export function coordinateBookingPaymentStatus<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    getPaymentStatus: (
      input: BookingIdentifiers & { userId: string; context: TenantContext },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.getPaymentStatus({ bookingId, userId, context })
  })
}

export function coordinateBookingCancellation<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    cancelBooking: (
      input: BookingIdentifiers & { userId: string; context: TenantContext },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.cancelBooking({ bookingId, userId, context })
  })
}

export function coordinateModificationQuote<TBody, T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<TBody>
    quoteModification: (
      input: BookingIdentifiers & {
        userId: string
        context: TenantContext
        body: TBody
      },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.quoteModification({ bookingId, userId, context, body })
  })
}

export function coordinateModificationApply<TBody, T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<TBody>
    applyModification: (
      input: BookingIdentifiers & {
        userId: string
        context: TenantContext
        body: TBody
      },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.applyModification({ bookingId, userId, context, body })
  })
}

export function coordinateModificationStatus<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<ModificationIdentifiers>
    getModificationStatus: (
      input: ModificationIdentifiers & { userId: string; context: TenantContext },
    ) => Promise<T>
  },
) {
  return coordinateOwnedOperation(dependencies, async ({ userId, context }) => {
    const { bookingId, modificationId } = await dependencies.getIdentifiers()
    return dependencies.getModificationStatus({
      bookingId,
      modificationId,
      userId,
      context,
    })
  })
}
