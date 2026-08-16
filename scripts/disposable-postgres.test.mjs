import assert from "node:assert/strict"
import test from "node:test"

import {
  assertDisposableSchemaName,
  createDisposableSchemaName,
  resolveDisposableDatabaseConfig,
  TEST_DATABASE_CONFIRMATION,
} from "./lib/disposable-postgres.mjs"

test("refuses to run without an explicit test database URL", () => {
  assert.throws(
    () => resolveDisposableDatabaseConfig({}),
    /PLAYTT_TEST_DATABASE_URL is required/
  )
})

test("refuses to run without the exact confirmation sentinel", () => {
  assert.throws(
    () =>
      resolveDisposableDatabaseConfig({
        PLAYTT_TEST_DATABASE_URL: "postgres://localhost/playtt_test",
      }),
    /PLAYTT_TEST_DATABASE_CONFIRM must equal/
  )
})

test("refuses the same database target as POSTGRES_URL", () => {
  assert.throws(
    () =>
      resolveDisposableDatabaseConfig({
        PLAYTT_TEST_DATABASE_URL:
          "postgres://test_user:test_password@db.example.com/playtt?sslmode=require",
        PLAYTT_TEST_DATABASE_CONFIRM: TEST_DATABASE_CONFIRMATION,
        POSTGRES_URL:
          "postgresql://application_user:other_password@DB.EXAMPLE.COM:5432/playtt?sslmode=disable",
      }),
    /must not target the same database as POSTGRES_URL/
  )
})

test("accepts an explicitly confirmed distinct test database", () => {
  assert.deepEqual(
    resolveDisposableDatabaseConfig({
      PLAYTT_TEST_DATABASE_URL: "postgres://localhost/playtt_test",
      PLAYTT_TEST_DATABASE_CONFIRM: TEST_DATABASE_CONFIRMATION,
      POSTGRES_URL: "postgres://localhost/playtt_application",
    }),
    { url: "postgres://localhost/playtt_test" }
  )
})

test("generates only unique, narrowly scoped disposable schema names", () => {
  const first = createDisposableSchemaName({
    now: 1_700_000_000_000,
    processId: 42,
    entropy: "0123456789ab",
  })
  const second = createDisposableSchemaName({
    now: 1_700_000_000_000,
    processId: 42,
    entropy: "abcdef012345",
  })

  assert.notEqual(first, second)
  assert.match(first, /^playtt_test_/)
  assert.doesNotThrow(() => assertDisposableSchemaName(first))
  assert.throws(() => assertDisposableSchemaName("public"), /Refusing unsafe/)
  assert.throws(
    () => assertDisposableSchemaName("playtt_test_shared"),
    /Refusing unsafe/
  )
})
