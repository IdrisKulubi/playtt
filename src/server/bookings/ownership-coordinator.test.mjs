import assert from "node:assert/strict"
import test from "node:test"

import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"
import {
  coordinateBookingCancellation,
  coordinateBookingDetail,
  coordinateBookingPaymentStart,
  coordinateBookingPaymentStatus,
  coordinateModificationApply,
  coordinateModificationQuote,
  coordinateModificationStatus,
} from "./ownership-coordinator.ts"

const testContext = {
  tenantId: PLAYTT_TENANT_ID,
  actor: { type: "user", id: "session-user" },
  membershipId: "membership-1",
  role: "customer",
  correlationId: "corr-test",
}

const guessedIdentifiers = {
  bookingId: "guessed-booking",
  modificationId: "guessed-modification",
  userId: "forged-user",
}

const forgedBody = {
  client: "mobile",
  notes: "Move this booking",
  userId: "forged-user",
}

function operationFixtures(actorId) {
  return [
    {
      name: "booking detail",
      coordinate: coordinateBookingDetail,
      domainKey: "getBooking",
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
      },
    },
    {
      name: "payment start",
      coordinate: coordinateBookingPaymentStart,
      domainKey: "startPayment",
      readBody: async () => forgedBody,
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
        body: forgedBody,
      },
    },
    {
      name: "payment status",
      coordinate: coordinateBookingPaymentStatus,
      domainKey: "getPaymentStatus",
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
      },
    },
    {
      name: "cancellation",
      coordinate: coordinateBookingCancellation,
      domainKey: "cancelBooking",
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
      },
    },
    {
      name: "modification quote",
      coordinate: coordinateModificationQuote,
      domainKey: "quoteModification",
      readBody: async () => forgedBody,
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
        body: forgedBody,
      },
    },
    {
      name: "modification apply",
      coordinate: coordinateModificationApply,
      domainKey: "applyModification",
      readBody: async () => forgedBody,
      expectedInput: {
        bookingId: "guessed-booking",
        userId: "session-user",
        context: testContext,
        body: forgedBody,
      },
    },
    {
      name: "modification status",
      coordinate: coordinateModificationStatus,
      domainKey: "getModificationStatus",
      expectedInput: {
        bookingId: "guessed-booking",
        modificationId: "guessed-modification",
        userId: "session-user",
        context: testContext,
      },
    },
  ].map((fixture) => ({
    ...fixture,
    dependencies: {
      getActorId: async () => actorId,
      resolveContext: async () => testContext,
      getIdentifiers: async () => guessedIdentifiers,
      ...(fixture.readBody ? { readBody: fixture.readBody } : {}),
    },
  }))
}

test("unauthenticated owned booking operations stop before request and domain work", async () => {
  for (const fixture of operationFixtures(null)) {
    let identifiersRead = 0
    let bodiesRead = 0
    let domainCalls = 0

    const result = await fixture.coordinate({
      ...fixture.dependencies,
      getIdentifiers: async () => {
        identifiersRead += 1
        return guessedIdentifiers
      },
      ...(fixture.readBody
        ? {
            readBody: async () => {
              bodiesRead += 1
              return forgedBody
            },
          }
        : {}),
      [fixture.domainKey]: async () => {
        domainCalls += 1
        return { operation: fixture.name }
      },
    })

    assert.deepEqual(result, { authenticated: false }, fixture.name)
    assert.equal(identifiersRead, 0, fixture.name)
    assert.equal(bodiesRead, 0, fixture.name)
    assert.equal(domainCalls, 0, fixture.name)
  }
})

test("owned booking operations bind guessed identifiers to the server actor", async () => {
  for (const fixture of operationFixtures("session-user")) {
    const domainCalls = []

    const result = await fixture.coordinate({
      ...fixture.dependencies,
      [fixture.domainKey]: async (input) => {
        domainCalls.push(input)
        return { operation: fixture.name }
      },
    })

    assert.deepEqual(domainCalls, [fixture.expectedInput], fixture.name)
    assert.deepEqual(
      result,
      {
        authenticated: true,
        value: { operation: fixture.name },
      },
      fixture.name,
    )
  }
})

test("runtime-forged identifier userId cannot replace the authenticated actor", async () => {
  const calls = []

  await coordinateModificationStatus({
    getActorId: async () => "session-user",
    resolveContext: async () => testContext,
    getIdentifiers: async () => guessedIdentifiers,
    getModificationStatus: async (input) => {
      calls.push(input)
      return { applied: false }
    },
  })

  assert.deepEqual(calls, [
    {
      bookingId: "guessed-booking",
      modificationId: "guessed-modification",
      userId: "session-user",
      context: testContext,
    },
  ])
})
