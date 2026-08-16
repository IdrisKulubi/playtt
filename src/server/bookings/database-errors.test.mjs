import assert from "node:assert/strict"
import test from "node:test"

import { isBookingOverlapConflict } from "./database-errors.ts"

test("recognizes direct PostgreSQL exclusion violations", () => {
  assert.equal(isBookingOverlapConflict({ code: "23P01" }), true)
  assert.equal(
    isBookingOverlapConflict({
      code: "23P01",
      constraint: "bookings_no_overlap",
    }),
    true
  )
})

test("recognizes an exclusion violation nested in an error cause", () => {
  const error = new Error("booking insert failed", {
    cause: {
      cause: {
        code: "23P01",
        constraint: "bookings_no_overlap",
      },
    },
  })

  assert.equal(isBookingOverlapConflict(error), true)
})

test("rejects other constraints and PostgreSQL error codes", () => {
  assert.equal(
    isBookingOverlapConflict({
      code: "23P01",
      constraint: "some_other_exclusion_constraint",
    }),
    false
  )
  assert.equal(
    isBookingOverlapConflict({
      code: "23505",
      constraint: "bookings_no_overlap",
    }),
    false
  )
  assert.equal(isBookingOverlapConflict({ code: "SLOT_UNAVAILABLE" }), false)
})

test("handles malformed and cyclic causes within the depth limit", () => {
  assert.equal(isBookingOverlapConflict(null), false)
  assert.equal(isBookingOverlapConflict({ cause: "not an error" }), false)

  const cyclic = {}
  cyclic.cause = cyclic

  assert.equal(isBookingOverlapConflict(cyclic), false)

  const tooDeep = { code: "23P01" }
  for (let depth = 0; depth < 5; depth += 1) {
    tooDeep.cause = { ...tooDeep }
    delete tooDeep.code
  }

  assert.equal(isBookingOverlapConflict(tooDeep), false)
})
