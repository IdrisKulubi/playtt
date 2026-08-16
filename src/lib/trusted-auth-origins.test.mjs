import assert from "node:assert/strict"
import test from "node:test"

import { resolveTrustedAuthOrigins } from "./trusted-auth-origins.ts"

test("includes permanent app, web, Apple, and development Expo origins", () => {
  const origins = resolveTrustedAuthOrigins({
    environment: "development",
    webOrigins: ["http://localhost:3000", "https://theplaytt.com"],
  })

  assert.ok(origins.includes("playtt://"))
  assert.ok(origins.includes("playtt://**"))
  assert.ok(origins.includes("exp://**"))
  assert.ok(origins.includes("exp://192.168.*.*:*/**"))
  assert.ok(origins.includes("http://localhost:3000"))
  assert.ok(origins.includes("https://appleid.apple.com"))
})

test("production excludes broad Expo origins by default", () => {
  const origins = resolveTrustedAuthOrigins({
    environment: "production",
    webOrigins: ["https://theplaytt.com"],
  })

  assert.ok(origins.includes("playtt://"))
  assert.ok(!origins.some((origin) => origin.startsWith("exp://")))
  assert.ok(!origins.some((origin) => origin.startsWith("exps://")))
})

test("production can explicitly opt in to broad Expo origins", () => {
  const origins = resolveTrustedAuthOrigins({
    environment: "production",
    trustExpoGo: " TRUE ",
    webOrigins: [],
  })

  assert.ok(origins.includes("exp://**"))
  assert.ok(origins.includes("exps://10.*.*.*:*/**"))
})

test("keeps safe exact callbacks while trimming, deduplicating, and rejecting unsafe entries", () => {
  const origins = resolveTrustedAuthOrigins({
    environment: "production",
    mobileAuthCallbackUrls: [
      " exp://192.168.1.20:8081/--/ ",
      "exp://192.168.1.20:8081/--/",
      "playtt://oauth/callback",
      "javascript:alert(1)",
      "https://attacker.example/callback",
      "exp://",
      "exp://192.168.*.*:*/**",
      "not a url",
    ].join(","),
    webOrigins: [],
  })

  assert.equal(
    origins.filter((origin) => origin === "exp://192.168.1.20:8081/--/")
      .length,
    1,
  )
  assert.ok(origins.includes("playtt://oauth/callback"))
  assert.ok(!origins.includes("javascript:alert(1)"))
  assert.ok(!origins.includes("https://attacker.example/callback"))
  assert.ok(!origins.includes("exp://"))
  assert.ok(!origins.includes("exp://192.168.*.*:*/**"))
})

test("deduplicates configured web and permanent origins", () => {
  const origins = resolveTrustedAuthOrigins({
    environment: "production",
    webOrigins: ["playtt://", "https://appleid.apple.com", "playtt://"],
  })

  assert.equal(origins.length, new Set(origins).size)
  assert.equal(origins.filter((origin) => origin === "playtt://").length, 1)
  assert.equal(
    origins.filter((origin) => origin === "https://appleid.apple.com").length,
    1,
  )
})
