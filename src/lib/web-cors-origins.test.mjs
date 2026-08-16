import assert from "node:assert/strict"
import test from "node:test"

import { resolveWebCorsOrigins } from "./web-cors-origins.ts"

const officialOrigins = [
  "https://www.theplaytt.com",
  "https://theplaytt.com",
]

test("production defaults to official HTTPS PlayTT origins only", () => {
  assert.deepEqual(
    resolveWebCorsOrigins({ environment: "production" }),
    officialOrigins,
  )
})

test("non-production adds the localhost development default", () => {
  assert.deepEqual(resolveWebCorsOrigins({ environment: "development" }), [
    ...officialOrigins,
    "http://localhost:3000",
  ])
})

test("trims, canonicalizes, and deduplicates all configured sources", () => {
  const origins = resolveWebCorsOrigins({
    environment: "production",
    webCorsOrigins: " https://preview.example.test/ ,https://preview.example.test",
    nextPublicAppUrl: "https://app.example.test:443/",
    betterAuthUrl: " https://auth.example.test ",
  })

  assert.deepEqual(origins, [
    ...officialOrigins,
    "https://preview.example.test",
    "https://app.example.test",
    "https://auth.example.test",
  ])
})

test("production rejects HTTP and loopback origins even when configured", () => {
  const origins = resolveWebCorsOrigins({
    environment: "production",
    webCorsOrigins: [
      "http://example.test",
      "https://localhost:3000",
      "https://api.localhost",
      "https://127.0.0.1",
      "https://127.200.10.20",
      "https://[::1]",
      "https://[0:0:0:0:0:0:0:1]",
      "https://0.0.0.0",
    ].join(","),
  })

  assert.deepEqual(origins, officialOrigins)
})

test("rejects credentials, paths, query, hash, wildcards, and unsupported schemes", () => {
  const origins = resolveWebCorsOrigins({
    environment: "development",
    webCorsOrigins: [
      "https://user:password@example.test",
      "https://example.test/callback",
      "https://example.test/?debug=true",
      "https://example.test/#fragment",
      "https://*.example.test",
      "javascript:alert(1)",
      "file:///tmp/playtt",
      "not a url",
    ].join(","),
  })

  assert.deepEqual(origins, [
    ...officialOrigins,
    "http://localhost:3000",
  ])
})

test("non-production accepts explicitly configured safe HTTP and HTTPS origins", () => {
  const origins = resolveWebCorsOrigins({
    environment: "test",
    nextPublicAppUrl: "http://127.0.0.1:3001/",
    betterAuthUrl: "https://staging.example.test/",
    webCorsOrigins: "http://192.168.1.25:3000",
  })

  assert.deepEqual(origins, [
    ...officialOrigins,
    "http://localhost:3000",
    "http://192.168.1.25:3000",
    "http://127.0.0.1:3001",
    "https://staging.example.test",
  ])
})
