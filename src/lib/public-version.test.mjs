import assert from "node:assert/strict"
import test from "node:test"

import { getPublicVersionInfo } from "./public-version.ts"

test("exposes only short operational version fields", () => {
  const result = getPublicVersionInfo("0123456789abcdef")

  assert.deepEqual(result, {
    commit: "0123456",
    appleSignInRoute: "/api/apple/sign-in",
  })
  assert.deepEqual(Object.keys(result).sort(), ["appleSignInRoute", "commit"])
})

test("uses a stable local marker when no commit is available", () => {
  assert.deepEqual(getPublicVersionInfo("  "), {
    commit: "local",
    appleSignInRoute: "/api/apple/sign-in",
  })
})
