import assert from "node:assert/strict"
import test from "node:test"

import {
  assertReplayStubExecutionAllowed,
  shouldAutoRunReplayStub,
} from "./stub-policy.ts"

test("auto-runs only for the exact true flag outside production", () => {
  for (const environment of ["development", "test", undefined]) {
    assert.equal(
      shouldAutoRunReplayStub({ environment, flag: "true" }),
      true,
    )
  }

  for (const flag of [undefined, "", "false", "TRUE", " true ", "1"]) {
    assert.equal(
      shouldAutoRunReplayStub({ environment: "development", flag }),
      false,
    )
  }
})

test("production ignores the auto-run flag", () => {
  assert.equal(
    shouldAutoRunReplayStub({ environment: "production", flag: "true" }),
    false,
  )
})

test("stub execution boundary throws in production", () => {
  assert.throws(
    () => assertReplayStubExecutionAllowed("production"),
    /disabled in production/,
  )
})

test("stub execution boundary permits development and test", () => {
  assert.doesNotThrow(() => assertReplayStubExecutionAllowed("development"))
  assert.doesNotThrow(() => assertReplayStubExecutionAllowed("test"))
  assert.doesNotThrow(() => assertReplayStubExecutionAllowed(undefined))
})
