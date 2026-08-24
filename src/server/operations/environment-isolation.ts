import {
  buildEnvironmentProfile,
  fingerprintConnectionUrl,
  fingerprintNamedResource,
  isNonProductionEnvironment,
  isProductionLikeEnvironment,
  resolveDeploymentEnvironment,
} from "./environment-profile.ts"
import type {
  CredentialFingerprint,
  EnvironmentOperationsReport,
  IsolationCheck,
  IsolationCheckStatus,
} from "./environment-types.ts"
import { RECOVERY_OBJECTIVES } from "./environment-types.ts"

function blockedProductionFingerprints(env: NodeJS.ProcessEnv) {
  return (env.PLAYTT_BLOCKED_RESOURCE_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function postgresHost(url: string | undefined) {
  const trimmed = url?.trim()

  if (!trimmed) {
    return null
  }

  try {
    const normalized = trimmed.replace(/^postgresql:/, "http:")
    return new URL(normalized).hostname.toLowerCase()
  } catch {
    return null
  }
}

function paystackKeyClass(secretKey: string | undefined) {
  const trimmed = secretKey?.trim()

  if (!trimmed) {
    return "missing"
  }

  if (trimmed.startsWith("sk_live_")) {
    return "live"
  }

  if (trimmed.startsWith("sk_test_")) {
    return "test"
  }

  return "unknown"
}

function rollupIsolationStatus(
  checks: IsolationCheck[],
): EnvironmentOperationsReport["status"] {
  if (checks.some((check) => check.status === "fail")) {
    return "fail"
  }

  if (checks.some((check) => check.status === "warn")) {
    return "warn"
  }

  return "ok"
}

export function buildCredentialFingerprints(
  env: NodeJS.ProcessEnv = process.env,
): CredentialFingerprint[] {
  return [
    {
      key: "postgres",
      label: "Database",
      fingerprint: fingerprintConnectionUrl(env.POSTGRES_URL),
      configured: Boolean(env.POSTGRES_URL?.trim()),
    },
    {
      key: "redis",
      label: "Redis",
      fingerprint: fingerprintConnectionUrl(env.REDIS_URL),
      configured: Boolean(env.REDIS_URL?.trim()),
    },
    {
      key: "r2_bucket",
      label: "R2 bucket",
      fingerprint: fingerprintNamedResource(env.R2_BUCKET),
      configured: Boolean(env.R2_BUCKET?.trim()),
    },
    {
      key: "paystack",
      label: "Paystack",
      fingerprint: fingerprintNamedResource(env.PAYSTACK_SECRET_KEY),
      configured: Boolean(env.PAYSTACK_SECRET_KEY?.trim()),
    },
    {
      key: "better_auth",
      label: "Auth secret",
      fingerprint: fingerprintNamedResource(env.BETTER_AUTH_SECRET),
      configured: Boolean(env.BETTER_AUTH_SECRET?.trim()),
    },
  ]
}

export function evaluateEnvironmentIsolation(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentOperationsReport {
  const profile = buildEnvironmentProfile(env)
  const fingerprints = buildCredentialFingerprints(env)
  const checks: IsolationCheck[] = []
  const blocked = new Set(blockedProductionFingerprints(env))
  const environment = resolveDeploymentEnvironment(env)
  const postgresUrl = env.POSTGRES_URL
  const host = postgresHost(postgresUrl)
  const paystackClass = paystackKeyClass(env.PAYSTACK_SECRET_KEY)
  const bucketName = env.R2_BUCKET?.trim().toLowerCase() ?? ""

  checks.push({
    key: "environment_classified",
    label: "Deployment environment",
    status: environment === "unknown" ? "warn" : "pass",
    summary:
      environment === "unknown"
        ? "Set PLAYTT_ENVIRONMENT or deploy through Vercel to classify this runtime"
        : `Classified as ${environment}`,
  })

  if (isProductionLikeEnvironment(environment)) {
    checks.push({
      key: "paystack_live_keys",
      label: "Paystack live credentials",
      status:
        paystackClass === "live"
          ? "pass"
          : paystackClass === "test"
            ? "fail"
            : "warn",
      summary:
        paystackClass === "live"
          ? "Live Paystack secret configured"
          : paystackClass === "test"
            ? "Test Paystack secret must not be used in production-like environments"
            : "Paystack secret missing or unrecognized prefix",
      runbookPath: "docs/operations/runbooks/secret-rotation.md",
    })
  } else {
    checks.push({
      key: "paystack_test_keys",
      label: "Paystack test credentials",
      status:
        paystackClass === "live"
          ? "fail"
          : paystackClass === "test"
            ? "pass"
            : "warn",
      summary:
        paystackClass === "live"
          ? "Live Paystack secret must not be used outside production"
          : paystackClass === "test"
            ? "Test Paystack secret configured"
            : "Paystack secret missing or unrecognized prefix",
      runbookPath: "docs/operations/runbooks/secret-rotation.md",
    })
  }

  if (environment === "production") {
    checks.push({
      key: "media_store_production",
      label: "Media store driver",
      status: profile.mediaStoreDriver === "fake" ? "fail" : "pass",
      summary:
        profile.mediaStoreDriver === "fake"
          ? "Fake media store is disabled in production"
          : `Media store driver is ${profile.mediaStoreDriver}`,
      runbookPath: "docs/operations/runbooks/infrastructure-r2.md",
    })

    checks.push({
      key: "cron_secret_production",
      label: "Cron secret",
      status: env.CRON_SECRET?.trim() ? "pass" : "fail",
      summary: env.CRON_SECRET?.trim()
        ? "CRON_SECRET configured"
        : "CRON_SECRET is required in production",
      runbookPath: "docs/operations/runbooks/secret-rotation.md",
    })

    checks.push({
      key: "redis_production",
      label: "Redis realtime channel",
      status: env.REDIS_URL?.trim() ? "pass" : "warn",
      summary: env.REDIS_URL?.trim()
        ? "REDIS_URL configured"
        : "REDIS_URL missing for production realtime",
      runbookPath: "docs/operations/runbooks/infrastructure-redis.md",
    })
  }

  if (host && (host === "localhost" || host === "127.0.0.1")) {
    checks.push({
      key: "postgres_not_local",
      label: "Database host isolation",
      status: isProductionLikeEnvironment(environment) ? "fail" : "warn",
      summary:
        "POSTGRES_URL points at localhost; hosted environments must use isolated Neon branches",
      runbookPath: "docs/operations/runbooks/database-restore.md",
    })
  }

  const authSecret = env.BETTER_AUTH_SECRET?.trim() ?? ""

  checks.push({
    key: "auth_secret_strength",
    label: "Auth secret strength",
    status:
      authSecret.length === 0
        ? "warn"
        : authSecret.length >= 32
          ? "pass"
          : "fail",
    summary:
      authSecret.length === 0
        ? "BETTER_AUTH_SECRET is not configured"
        : authSecret.length >= 32
          ? "BETTER_AUTH_SECRET meets minimum length"
          : "BETTER_AUTH_SECRET must be at least 32 characters",
    runbookPath: "docs/operations/runbooks/secret-rotation.md",
  })

  if (
    bucketName &&
    isNonProductionEnvironment(environment) &&
    (bucketName.includes("prod") || bucketName.includes("production"))
  ) {
    checks.push({
      key: "r2_bucket_isolation",
      label: "R2 bucket naming",
      status: "warn",
      summary:
        "Non-production runtime references a production-looking R2 bucket name",
      runbookPath: "docs/operations/runbooks/infrastructure-r2.md",
    })
  }

  const blockedMatches = fingerprints
    .map((entry) => entry.fingerprint)
    .filter((fingerprint): fingerprint is string =>
      Boolean(fingerprint && blocked.has(fingerprint)),
    )

  if (blocked.size > 0 && isNonProductionEnvironment(environment)) {
    checks.push({
      key: "blocked_production_fingerprints",
      label: "Blocked production fingerprints",
      status: blockedMatches.length > 0 ? "fail" : "pass",
      summary:
        blockedMatches.length > 0
          ? `${blockedMatches.length} configured resource fingerprint(s) match blocked production values`
          : "No blocked production resource fingerprints detected",
      runbookPath: "docs/operations/disaster-recovery.md",
    })
  }

  checks.push({
    key: "credential_fingerprints",
    label: "Credential fingerprints",
    status: "info",
    summary:
      "Compare hashed resource fingerprints across dev, preview, staging, and production before rollout",
    runbookPath: "docs/operations/disaster-recovery.md",
  })

  return {
    generatedAt: new Date().toISOString(),
    status: rollupIsolationStatus(checks),
    profile,
    checks,
    fingerprints,
    recoveryObjectives: RECOVERY_OBJECTIVES,
  }
}

export function isolationChecksForCi(report: EnvironmentOperationsReport) {
  return report.checks.filter((check) => check.status !== "info")
}

export function isolationCheckHasFailure(checks: IsolationCheck[]) {
  return checks.some((check) => check.status === "fail")
}

export function worstIsolationStatus(
  left: IsolationCheckStatus,
  right: IsolationCheckStatus,
): IsolationCheckStatus {
  const order: Record<IsolationCheckStatus, number> = {
    info: 0,
    pass: 1,
    warn: 2,
    fail: 3,
  }

  return order[right] > order[left] ? right : left
}
