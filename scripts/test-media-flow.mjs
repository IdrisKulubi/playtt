import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const E2E_SESSION_TOKEN = "e2e-test-session-token-fixed"
const E2E_USER_EMAIL = "e2e@playtt.test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const baseUrl = process.env.PLAYTT_BASE_URL?.trim() || "http://127.0.0.1:3000"
const bearerToken = process.env.MEDIA_FLOW_BEARER_TOKEN?.trim() || E2E_SESSION_TOKEN

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()

  if (!databaseUrl) {
    throw new Error(
      "POSTGRES_URL is required. Run with: node --env-file=.env.local scripts/test-media-flow.mjs",
    )
  }

  return databaseUrl
}

async function seedE2eUser(sql) {
  await sql.unsafe(readFileSync(join(root, "db", "seed-test-e2e.sql"), "utf8"))
}

async function ensurePrivateMediaFlag(sql) {
  await sql`
    insert into feature_flags (tenant_id, key, enabled)
    values ('33333333-3333-3333-3333-333333333333', 'private_media', true)
    on conflict (tenant_id, key) do update
    set enabled = true, updated_at = now()
  `
}

async function ensureTenantMembership(sql, userId) {
  await sql`
    insert into tenant_memberships (tenant_id, user_id, role, status)
    values ('33333333-3333-3333-3333-333333333333', ${userId}, 'customer', 'active')
    on conflict do nothing
  `
}

async function resolveAuthUser(sql) {
  if (process.env.MEDIA_FLOW_BEARER_TOKEN?.trim()) {
    const [row] = await sql`
      select s.user_id, u.email
      from session s
      inner join "user" u on u.id = s.user_id
      where s.token = ${process.env.MEDIA_FLOW_BEARER_TOKEN.trim()}
      limit 1
    `

    if (!row) {
      throw new Error("MEDIA_FLOW_BEARER_TOKEN does not match any active session.")
    }

    return { userId: row.user_id, email: row.email }
  }

  await seedE2eUser(sql)
  return { userId: "e2e-test-player", email: E2E_USER_EMAIL }
}

async function findPlaySessionForUser(sql, userId) {
  const [row] = await sql`
    select
      ps.id,
      ps.tenant_id,
      ps.location_id,
      ps.resource_id,
      ps.status,
      b.id as booking_id
    from play_sessions ps
    inner join bookings b
      on b.id = ps.booking_id
     and b.tenant_id = ps.tenant_id
    where b.user_id = ${userId}
    order by ps.created_at desc
    limit 1
  `

  return row ?? null
}

async function createTestPlaySession(sql, userId) {
  const [resource] = await sql`
    select id, tenant_id, location_id, ruleset, configuration, metadata, name, code
    from resources
    where tenant_id = '33333333-3333-3333-3333-333333333333'
      and is_active = true
    order by created_at asc
    limit 1
  `

  if (!resource) {
    throw new Error("No active resource found. Run phase 1 seed first.")
  }

  const bookingId = randomUUID()
  const playSessionId = randomUUID()
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 60 * 1000)
  const end = new Date(now.getTime() + 90 * 60 * 1000)

  await sql`
    insert into bookings (
      id,
      tenant_id,
      user_id,
      location_id,
      resource_id,
      status,
      payment_status,
      start_time,
      end_time,
      duration_minutes,
      group_size,
      subtotal_amount,
      discount_amount,
      total_amount,
      currency,
      pricing_rule_snapshot
    )
    values (
      ${bookingId},
      ${resource.tenant_id},
      ${userId},
      ${resource.location_id},
      ${resource.id},
      'confirmed',
      'paid',
      ${start},
      ${end},
      60,
      2,
      '1000',
      '0',
      '1000',
      'KES',
      '{}'::jsonb
    )
  `

  await sql`
    insert into play_sessions (
      id,
      tenant_id,
      booking_id,
      location_id,
      resource_id,
      status,
      correlation_id,
      scheduled_start_at,
      scheduled_end_at,
      configuration_snapshot,
      configuration_version
    )
    values (
      ${playSessionId},
      ${resource.tenant_id},
      ${bookingId},
      ${resource.location_id},
      ${resource.id},
      'active',
      ${`media-flow-${randomUUID()}`},
      ${start},
      ${end},
      ${sql.json({
        resource: {
          ruleset: resource.ruleset,
          configuration: resource.configuration,
          metadata: resource.metadata,
          name: resource.name,
          code: resource.code,
        },
      })},
      1
    )
  `

  return {
    id: playSessionId,
    tenant_id: resource.tenant_id,
    booking_id: bookingId,
    status: "active",
  }
}

async function api(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { response, body }
}

function assertOk(step, result, expectedStatus) {
  if (result.response.status !== expectedStatus) {
    throw new Error(
      `${step} failed (${result.response.status}): ${JSON.stringify(result.body)}`,
    )
  }
}

async function main() {
  const sql = postgres(requireDatabaseUrl(), { max: 1 })

  try {
    await ensurePrivateMediaFlag(sql)
    const authUser = await resolveAuthUser(sql)
    await ensureTenantMembership(sql, authUser.userId)

    let playSession = await findPlaySessionForUser(sql, authUser.userId)

    if (!playSession) {
      console.log(`No play session for ${authUser.email}; creating test booking/session…`)
      playSession = await createTestPlaySession(sql, authUser.userId)
    }

    console.log("Media flow test")
    console.log(`  base url: ${baseUrl}`)
    console.log(`  user: ${authUser.email}`)
    console.log(`  play session: ${playSession.id}`)

    console.log("\n1. POST /api/v1/media")
    const createResult = await api("/api/v1/media", {
      method: "POST",
      body: JSON.stringify({
        playSessionId: playSession.id,
        kind: "source_video",
      }),
    })
    assertOk("create media", createResult, 201)
    const mediaId = createResult.body?.data?.media?.id
    const objectKey = createResult.body?.data?.media?.objectKey

    if (!mediaId || !objectKey) {
      throw new Error(`Create media response missing id/objectKey: ${JSON.stringify(createResult.body)}`)
    }

    console.log(`   ok mediaId=${mediaId}`)

    console.log("\n2. POST /api/v1/media/:mediaId/upload-url")
    const uploadGrantResult = await api(`/api/v1/media/${mediaId}/upload-url`, {
      method: "POST",
    })
    assertOk("upload grant", uploadGrantResult, 200)
    const uploadGrant = uploadGrantResult.body?.data?.grant

    if (!uploadGrant?.url) {
      throw new Error(`Upload grant missing url: ${JSON.stringify(uploadGrantResult.body)}`)
    }

    console.log(`   ok expiresAt=${uploadGrant.expiresAt}`)

    console.log("\n3. PUT object to R2")
    const sampleBytes = Buffer.from(`playtt-media-flow ${new Date().toISOString()}`)
    const putResponse = await fetch(uploadGrant.url, {
      method: "PUT",
      headers: {
        "Content-Type": uploadGrant.contentType || "video/mp4",
        "Content-Length": String(sampleBytes.length),
      },
      body: sampleBytes,
    })

    if (!putResponse.ok) {
      const putBody = await putResponse.text()
      throw new Error(`R2 PUT failed (${putResponse.status}): ${putBody}`)
    }

    console.log(`   ok uploaded ${sampleBytes.length} bytes`)

    console.log("\n4. POST /api/v1/media/:mediaId/complete")
    const checksumSha256 = createHash("sha256").update(sampleBytes).digest("hex")
    const completeResult = await api(`/api/v1/media/${mediaId}/complete`, {
      method: "POST",
      body: JSON.stringify({ checksumSha256 }),
    })
    assertOk("complete media", completeResult, 200)
    console.log(`   ok status=${completeResult.body?.data?.media?.status}`)

    console.log("\n5. POST /api/v1/media/:mediaId/download-url")
    const downloadGrantResult = await api(`/api/v1/media/${mediaId}/download-url`, {
      method: "POST",
    })
    assertOk("download grant", downloadGrantResult, 200)
    const downloadGrant = downloadGrantResult.body?.data?.grant

    if (!downloadGrant?.url) {
      throw new Error(`Download grant missing url: ${JSON.stringify(downloadGrantResult.body)}`)
    }

    console.log(`   ok expiresAt=${downloadGrant.expiresAt}`)

    console.log("\n6. GET playback URL")
    const playbackResponse = await fetch(downloadGrant.url)
    const playbackBody = Buffer.from(await playbackResponse.arrayBuffer())

    if (!playbackResponse.ok) {
      throw new Error(`Playback GET failed (${playbackResponse.status})`)
    }

    if (!playbackBody.equals(sampleBytes)) {
      throw new Error("Playback body does not match uploaded bytes")
    }

    console.log(`   ok downloaded ${playbackBody.length} bytes`)

    console.log("\n7. DELETE /api/v1/media/:mediaId")
    const deleteResult = await api(`/api/v1/media/${mediaId}`, {
      method: "DELETE",
    })
    assertOk("delete media", deleteResult, 200)
    console.log(`   ok status=${deleteResult.body?.data?.media?.status}`)

    console.log("\nFull media app flow verified successfully.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error("\nMedia flow test failed.")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
