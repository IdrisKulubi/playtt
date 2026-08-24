import { createHash } from "node:crypto"

import type { DeploymentEnvironment, EnvironmentProfile } from "./environment-types.ts"

function resolveMediaStoreDriver(env: NodeJS.ProcessEnv) {
  const configured = env.MEDIA_STORE_DRIVER?.trim().toLowerCase()

  if (configured === "r2" || configured === "fake") {
    return configured
  }

  const hasR2Config =
    Boolean(env.R2_BUCKET?.trim()) &&
    Boolean(env.R2_ACCESS_KEY_ID?.trim()) &&
    Boolean(env.R2_SECRET_ACCESS_KEY?.trim())

  return hasR2Config ? "r2" : "fake"
}

export function resolveDeploymentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentEnvironment {
  const explicit = env.PLAYTT_ENVIRONMENT?.trim().toLowerCase()

  if (
    explicit === "development" ||
    explicit === "preview" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit
  }

  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase()

  if (vercelEnv === "production") {
    return "production"
  }

  if (vercelEnv === "preview") {
    return "preview"
  }

  if (vercelEnv === "development") {
    return "development"
  }

  if (env.NODE_ENV === "production") {
    return "production"
  }

  if (env.NODE_ENV === "test") {
    return "development"
  }

  if (env.NODE_ENV === "development") {
    return "development"
  }

  return "unknown"
}

export function buildEnvironmentProfile(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentProfile {
  const commit = env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null

  return {
    environment: resolveDeploymentEnvironment(env),
    vercelEnv: env.VERCEL_ENV?.trim() ?? null,
    nodeEnv: env.NODE_ENV ?? "development",
    commit,
    mediaStoreDriver: resolveMediaStoreDriver(env),
  }
}

export function hashResourceFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12)
}

export function fingerprintConnectionUrl(url: string | undefined) {
  const trimmed = url?.trim()

  if (!trimmed) {
    return null
  }

  try {
    const normalized = trimmed.replace(/^postgresql:/, "http:")
    const parsed = new URL(normalized)
    const database = parsed.pathname.replace(/^\//, "")

    return hashResourceFingerprint(
      `${parsed.hostname}|${parsed.username}|${database}`,
    )
  } catch {
    return hashResourceFingerprint(trimmed)
  }
}

export function fingerprintNamedResource(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  return hashResourceFingerprint(trimmed)
}

export function isProductionLikeEnvironment(environment: DeploymentEnvironment) {
  return environment === "production" || environment === "staging"
}

export function isNonProductionEnvironment(environment: DeploymentEnvironment) {
  return (
    environment === "development" ||
    environment === "preview" ||
    environment === "staging"
  )
}
