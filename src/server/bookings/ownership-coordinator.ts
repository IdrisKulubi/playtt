export type OwnedOperationResult<T> =
  | { authenticated: false }
  | { authenticated: true; value: T }

type ActorDependencies = {
  getActorId: () => Promise<string | null>
}

async function coordinateOwnedOperation<T>(
  dependencies: ActorDependencies,
  operation: (actorId: string) => Promise<T>
): Promise<OwnedOperationResult<T>> {
  const actorId = await dependencies.getActorId()

  if (!actorId) {
    return { authenticated: false }
  }

  return {
    authenticated: true,
    value: await operation(actorId),
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
    getBooking: (input: BookingIdentifiers & { userId: string }) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.getBooking({ bookingId, userId })
  })
}

export function coordinateBookingPaymentStart<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<unknown>
    startPayment: (
      input: BookingIdentifiers & { userId: string; body: unknown }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.startPayment({ bookingId, userId, body })
  })
}

export function coordinateBookingPaymentStatus<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    getPaymentStatus: (
      input: BookingIdentifiers & { userId: string }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.getPaymentStatus({ bookingId, userId })
  })
}

export function coordinateBookingCancellation<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    cancelBooking: (
      input: BookingIdentifiers & { userId: string }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    return dependencies.cancelBooking({ bookingId, userId })
  })
}

export function coordinateModificationQuote<TBody, T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<TBody>
    quoteModification: (
      input: BookingIdentifiers & { userId: string; body: TBody }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.quoteModification({ bookingId, userId, body })
  })
}

export function coordinateModificationApply<TBody, T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<BookingIdentifiers>
    readBody: () => Promise<TBody>
    applyModification: (
      input: BookingIdentifiers & { userId: string; body: TBody }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId } = await dependencies.getIdentifiers()
    const body = await dependencies.readBody()
    return dependencies.applyModification({ bookingId, userId, body })
  })
}

export function coordinateModificationStatus<T>(
  dependencies: ActorDependencies & {
    getIdentifiers: () => Promise<ModificationIdentifiers>
    getModificationStatus: (
      input: ModificationIdentifiers & { userId: string }
    ) => Promise<T>
  }
) {
  return coordinateOwnedOperation(dependencies, async (userId) => {
    const { bookingId, modificationId } = await dependencies.getIdentifiers()
    return dependencies.getModificationStatus({
      bookingId,
      modificationId,
      userId,
    })
  })
}
