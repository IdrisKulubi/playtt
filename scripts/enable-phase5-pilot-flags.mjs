#!/usr/bin/env node
import postgres from "postgres"

const PLAYTT_TENANT_ID = "33333333-3333-3333-3333-333333333333"

const PHASE5_FLAGS = [
  "live_access",
  "ttlock_provider",
  "relay_automation",
  "access_notifications",
  "remote_unlock",
]

function parseArgs(argv) {
  const options = {
    confirmCommissioned: false,
    dryRun: false,
    enable: [...PHASE5_FLAGS],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--confirm-commissioned") {
      options.confirmCommissioned = true
      continue
    }
    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }
    if (arg === "--enable") {
      const value = argv[index + 1]
      if (!value) throw new Error("--enable requires a comma-separated flag list.")
      options.enable = value.split(",").map((item) => item.trim())
      index += 1
    }
  }

  return options
}

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!databaseUrl) {
    throw new Error(
      "POSTGRES_URL is required. Run with: node --env-file=.env.local scripts/enable-phase5-pilot-flags.mjs",
    )
  }
  return databaseUrl
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!options.confirmCommissioned) {
    console.log("Pilot flags remain disabled until commissioning is complete.")
    console.log("Re-run with --confirm-commissioned after:")
    console.log("  docs/operations/certification/ttlock-keypad-acceptance.md")
    console.log("  docs/operations/certification/phase5-pilot-rollout.md")
    console.log("")
    console.log("Flags that would be enabled:")
    for (const key of options.enable) console.log(`  - ${key}`)
    process.exit(0)
  }

  const sql = postgres(requireDatabaseUrl(), { max: 1 })

  try {
    const current = await sql`
      select key, enabled
      from feature_flags
      where tenant_id = ${PLAYTT_TENANT_ID}
        and key = any(${options.enable})
      order by key
    `

    console.log("Current pilot flags:")
    for (const row of current) {
      console.log(`  ${row.key}: ${row.enabled ? "enabled" : "disabled"}`)
    }

    if (options.dryRun) {
      console.log("")
      console.log("Dry run only. No changes written.")
      return
    }

    for (const key of options.enable) {
      await sql`
        insert into feature_flags (tenant_id, key, enabled)
        values (${PLAYTT_TENANT_ID}, ${key}, true)
        on conflict (tenant_id, key) do update
        set enabled = true, updated_at = now()
      `
    }

    console.log("")
    console.log("Enabled pilot flags independently:")
    for (const key of options.enable) console.log(`  - ${key}`)
    console.log("")
    console.log("Set TTLOCK_PROVIDER_MODE=real only after Sciener commissioning succeeds.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
