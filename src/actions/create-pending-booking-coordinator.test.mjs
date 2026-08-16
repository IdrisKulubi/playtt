import assert from "node:assert/strict"
import test from "node:test"

import { coordinatePendingBookingCreation } from "./create-pending-booking-coordinator.ts"

const bookingInput = {
  durationMinutes: 60,
  groupSize: 4,
  locationId: "location-1",
  notes: "Window table",
  resourceId: "resource-1",
  startTimeIso: "2026-08-20T10:00:00.000Z",
}

function createDependencies(overrides = {}) {
  const calls = {
    createBooking: [],
    getProfile: [],
    getSession: 0,
  }

  return {
    calls,
    dependencies: {
      createBooking: async (input) => {
        calls.createBooking.push(input)
        return { id: "booking-1", status: "pending" }
      },
      getProfile: async (userId) => {
        calls.getProfile.push(userId)
        return { onboardingCompletedAt: new Date("2026-08-01T00:00:00.000Z") }
      },
      getSession: async () => {
        calls.getSession += 1
        return { user: { id: "session-user" } }
      },
      ...overrides,
    },
  }
}

test("unauthenticated request never reads a profile or creates a booking", async () => {
  const fixture = createDependencies({ getSession: async () => null })

  const result = await coordinatePendingBookingCreation(
    bookingInput,
    fixture.dependencies,
  )

  assert.deepEqual(result, {
    success: false,
    message: "Sign in is required.",
  })
  assert.deepEqual(fixture.calls.getProfile, [])
  assert.deepEqual(fixture.calls.createBooking, [])
})

test("incomplete onboarding never creates a booking", async () => {
  const fixture = createDependencies({
    getProfile: async (userId) => {
      fixture.calls.getProfile.push(userId)
      return { onboardingCompletedAt: null }
    },
  })

  const result = await coordinatePendingBookingCreation(
    bookingInput,
    fixture.dependencies,
  )

  assert.deepEqual(result, {
    success: false,
    message: "Complete your player profile before booking.",
  })
  assert.deepEqual(fixture.calls.getProfile, ["session-user"])
  assert.deepEqual(fixture.calls.createBooking, [])
})

test("valid request uses only the session user and discards a forged userId", async () => {
  const fixture = createDependencies()
  const forgedInput = { ...bookingInput, userId: "forged-user" }

  const result = await coordinatePendingBookingCreation(
    forgedInput,
    fixture.dependencies,
  )

  assert.deepEqual(fixture.calls.getProfile, ["session-user"])
  assert.deepEqual(fixture.calls.createBooking, [
    { ...bookingInput, userId: "session-user" },
  ])
  assert.deepEqual(result, {
    success: true,
    data: { id: "booking-1", status: "pending" },
  })
})

test("dependency errors preserve the public failure shape", async () => {
  const fixture = createDependencies({
    createBooking: async () => {
      throw new Error("Slot is no longer available.")
    },
  })

  assert.deepEqual(
    await coordinatePendingBookingCreation(bookingInput, fixture.dependencies),
    { success: false, message: "Slot is no longer available." },
  )

  fixture.dependencies.createBooking = async () => {
    throw "unexpected"
  }
  assert.deepEqual(
    await coordinatePendingBookingCreation(bookingInput, fixture.dependencies),
    { success: false, message: "Failed to create pending booking." },
  )
})
