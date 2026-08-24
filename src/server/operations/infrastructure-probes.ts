import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"
import { sql } from "drizzle-orm"

import db from "@/db/drizzle"

export interface InfrastructureProbeResult {
  configured: boolean
  ok: boolean
  summary: string
  latencyMs?: number
}

function isR2Configured() {
  return (
    Boolean(process.env.R2_BUCKET?.trim()) &&
    Boolean(process.env.R2_ACCESS_KEY_ID?.trim()) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY?.trim()) &&
    Boolean(process.env.R2_ACCOUNT_ID?.trim())
  )
}

function createProbeR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID!.trim()
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ??
    `https://${accountId}.r2.cloudflarestorage.com`

  return new S3Client({
    region: process.env.R2_REGION?.trim() || "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
}

async function loadRedisPing() {
  try {
    const loadModule = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{
      createClient: (options: { url: string }) => {
        connect(): Promise<void>
        ping(): Promise<string>
        quit(): Promise<void>
      }
    }>

    const module = await loadModule("redis")
    return module.createClient
  } catch {
    return null
  }
}

export async function probeDatabase(): Promise<InfrastructureProbeResult> {
  if (!process.env.POSTGRES_URL?.trim()) {
    return {
      configured: false,
      ok: false,
      summary: "POSTGRES_URL not configured",
    }
  }

  const startedAt = Date.now()

  try {
    await db.execute(sql`select 1`)
    const latencyMs = Date.now() - startedAt

    return {
      configured: true,
      ok: true,
      summary: `Database reachable (${latencyMs}ms)`,
      latencyMs,
    }
  } catch {
    return {
      configured: true,
      ok: false,
      summary: "Database probe failed",
    }
  }
}

export async function probeRedis(): Promise<InfrastructureProbeResult> {
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    return {
      configured: false,
      ok: false,
      summary: "REDIS_URL not configured",
    }
  }

  const createClient = await loadRedisPing()

  if (!createClient) {
    return {
      configured: true,
      ok: false,
      summary: "Redis client module unavailable",
    }
  }

  const startedAt = Date.now()
  const client = createClient({ url: redisUrl })

  try {
    await client.connect()
    await client.ping()
    const latencyMs = Date.now() - startedAt

    return {
      configured: true,
      ok: true,
      summary: `Redis reachable (${latencyMs}ms)`,
      latencyMs,
    }
  } catch {
    return {
      configured: true,
      ok: false,
      summary: "Redis probe failed",
    }
  } finally {
    await client.quit().catch(() => undefined)
  }
}

export async function probeR2Storage(): Promise<InfrastructureProbeResult> {
  if (!isR2Configured()) {
    return {
      configured: false,
      ok: false,
      summary: "R2 credentials not configured",
    }
  }

  const startedAt = Date.now()
  const client = createProbeR2Client()
  const bucket = process.env.R2_BUCKET!.trim()

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    const latencyMs = Date.now() - startedAt

    return {
      configured: true,
      ok: true,
      summary: `R2 bucket reachable (${latencyMs}ms)`,
      latencyMs,
    }
  } catch {
    return {
      configured: true,
      ok: false,
      summary: "R2 bucket probe failed",
    }
  }
}

export async function probeInfrastructure(): Promise<{
  database: InfrastructureProbeResult
  redis: InfrastructureProbeResult
  storage: InfrastructureProbeResult
}> {
  const [database, redis, storage] = await Promise.all([
    probeDatabase(),
    probeRedis(),
    probeR2Storage(),
  ])

  return { database, redis, storage }
}
