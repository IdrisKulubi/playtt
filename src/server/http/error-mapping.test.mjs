import assert from "node:assert/strict"
import test from "node:test"

import { mapDomainOrUnexpectedError } from "./error-mapping.ts"

class TestDomainError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

const fallback = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong while processing the request.",
}

const isTestDomainError = (error) => error instanceof TestDomainError

test("preserves typed domain error code, message, and status", () => {
  const result = mapDomainOrUnexpectedError(
    new TestDomainError("NOT_FOUND", "The item was not found.", 404),
    isTestDomainError,
    fallback,
  )

  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "The item was not found.",
    status: 404,
  })
})

test("maps unexpected Error instances without exposing their messages", () => {
  const result = mapDomainOrUnexpectedError(
    new Error("postgres://user:secret@internal.example/database"),
    isTestDomainError,
    fallback,
  )

  assert.deepEqual(result, { ...fallback, status: 500 })
  assert.doesNotMatch(result.message, /postgres|secret|internal/i)
})

test("maps non-Error thrown values to the same stable response", () => {
  assert.deepEqual(
    mapDomainOrUnexpectedError({ password: "secret" }, isTestDomainError, fallback),
    { ...fallback, status: 500 },
  )
  assert.deepEqual(
    mapDomainOrUnexpectedError("failed", isTestDomainError, fallback),
    { ...fallback, status: 500 },
  )
})
