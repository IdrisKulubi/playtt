import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  evaluateEnvironmentIsolation,
  isolationCheckHasFailure,
} from "./environment-isolation.ts"
import {
  buildEnvironmentProfile,
  fingerprintConnectionUrl,
  hashResourceFingerprint,
  resolveDeploymentEnvironment,
} from "./environment-profile.ts"

test("resolveDeploymentEnvironment prefers PLAYTT_ENVIRONMENT then VERCEL_ENV", () => {
  assert.equal(
    resolveDeploymentEnvironment({
      PLAYTT_ENVIRONMENT: "staging",
      VERCEL_ENV: "production",
      NODE_ENV: "development",
    }),
    "staging",
  )

  assert.equal(
    resolveDeploymentEnvironment({
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    }),
    "preview",
  )
})

test("fingerprintConnectionUrl hashes host and database without exposing secrets", () => {
  const fingerprint = fingerprintConnectionUrl(
    "postgresql://playtt_user:super-secret@db.example.com:5432/playtt_staging",
  )

  assert.match(fingerprint ?? "", /^[a-f0-9]{12}$/)
  assert.notEqual(fingerprint, "super-secret")
})

test("evaluateEnvironmentIsolation rejects live Paystack keys outside production", () => {
  const report = evaluateEnvironmentIsolation({
    PLAYTT_ENVIRONMENT: "preview",
    NODE_ENV: "production",
    PAYSTACK_SECRET_KEY: "sk_live_preview_should_fail",
    BETTER_AUTH_SECRET: "x".repeat(32),
    POSTGRES_URL: "postgresql://user:pass@db.example.com/playtt_preview",
  })

  assert.equal(
    report.checks.find((check) => check.key === "paystack_test_keys")?.status,
    "fail",
  )
})

test("evaluateEnvironmentIsolation requires cron secret in production", () => {
  const report = evaluateEnvironmentIsolation({
    PLAYTT_ENVIRONMENT: "production",
    NODE_ENV: "production",
    PAYSTACK_SECRET_KEY: "sk_live_example",
    BETTER_AUTH_SECRET: "x".repeat(32),
    POSTGRES_URL: "postgresql://user:pass@db.example.com/playtt_prod",
    MEDIA_STORE_DRIVER: "r2",
    R2_BUCKET: "playtt-prod",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_ACCOUNT_ID: "account",
  })

  assert.equal(
    report.checks.find((check) => check.key === "cron_secret_production")?.status,
    "fail",
  )
  assert.equal(report.status, "fail")
})

test("evaluateEnvironmentIsolation blocks configured production fingerprints in preview", () => {
  const postgresUrl = "postgresql://user:pass@db.example.com/playtt_prod"
  const fingerprint = fingerprintConnectionUrl(postgresUrl)

  const report = evaluateEnvironmentIsolation({
    PLAYTT_ENVIRONMENT: "preview",
    NODE_ENV: "production",
    PAYSTACK_SECRET_KEY: "sk_test_example",
    BETTER_AUTH_SECRET: "x".repeat(32),
    POSTGRES_URL: postgresUrl,
    PLAYTT_BLOCKED_RESOURCE_FINGERPRINTS: fingerprint ?? "",
  })

  assert.equal(
    report.checks.find((check) => check.key === "blocked_production_fingerprints")
      ?.status,
    "fail",
  )
  assert.equal(isolationCheckHasFailure(report.checks), true)
})

test("buildEnvironmentProfile exposes deployment metadata without secrets", () => {
  const profile = buildEnvironmentProfile({
    PLAYTT_ENVIRONMENT: "staging",
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_SHA: "abc1234567890",
    MEDIA_STORE_DRIVER: "fake",
  })

  assert.equal(profile.environment, "staging")
  assert.equal(profile.mediaStoreDriver, "fake")
  assert.equal(profile.commit, "abc1234567890")
})

test("hashResourceFingerprint is stable", () => {
  assert.equal(
    hashResourceFingerprint("playtt-staging"),
    hashResourceFingerprint("playtt-staging"),
  )
})

test("environment service authorizes venue.read and admin routes expose environment UI", () => {
  const operationsRoot = join(import.meta.dirname)
  const repoRoot = join(import.meta.dirname, "..", "..", "..")
  const service = readFileSync(
    join(operationsRoot, "environment-service.ts"),
    "utf8",
  )
  const page = readFileSync(
    join(repoRoot, "src", "app", "admin", "environment", "page.tsx"),
    "utf8",
  )
  const sidebar = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-sidebar.tsx"),
    "utf8",
  )

  assert.match(service, /authorize\(context, "venue\.read"\)/)
  assert.match(service, /evaluateEnvironmentIsolation/)
  assert.match(page, /getEnvironmentOperationsReport/)
  assert.match(sidebar, /\/admin\/environment/)
})