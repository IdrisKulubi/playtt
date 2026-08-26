#!/usr/bin/env node
import postgres from "postgres"

import { applyLegacyVenueEdgeTopologyPlan } from "./lib/venue-edge-topology-apply.mjs"
import {
  planLegacyVenueEdgeTopology,
  summarizeLegacyVenueEdgePlan,
} from "./lib/venue-edge-topology-backfill.mjs"

const REQUIRED_TABLES = [
  "replay_recorders",
  "replay_camera_sources",
  "replay_source_routes",
  "replay_source_policies",
  "venue_edge_secret_refs",
]
const APPLY_CONFIRMATION = "--confirm-legacy-edge-backfill"

function parseArgs(argv) {
  const args = new Set(argv)
  const value = (prefix) =>
    argv
      .find((item) => item.startsWith(`${prefix}=`))
      ?.slice(prefix.length + 1) ?? null
  return {
    apply: args.has("--apply"),
    confirmed: args.has(APPLY_CONFIRMATION),
    json: args.has("--json"),
    help: args.has("--help") || args.has("-h"),
    tenantId: value("--tenant"),
    locationId: value("--location"),
  }
}

function printHelp() {
  console.log(`Usage:
  node --env-file=.env.local scripts/backfill-venue-edge-topology.mjs [options]

Default behavior is a read-only dry run.

Options:
  --tenant=<uuid>       Limit inspection to one tenant
  --location=<uuid>     Limit inspection to one venue
  --json                Print a machine-readable, credential-free report
  --apply               Insert missing normalized topology rows
  ${APPLY_CONFIRMATION}  Required together with --apply
  --help                Show this help

The script never updates or deletes v1 device assignments. It does not publish
Config v2. Every migrated recorder receives an unresolved local credential key
that must be provisioned on the venue PC before publication.`)
}

function requireDatabaseUrl() {
  const value = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!value) {
    throw new Error("POSTGRES_URL is required for topology inspection.")
  }
  return value
}

async function assertFoundationExists(sql) {
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ${sql(REQUIRED_TABLES)}
  `
  const present = new Set(rows.map((row) => row.table_name))
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table))
  if (missing.length > 0) {
    throw new Error(
      `VenueEdge foundation is missing: ${missing.join(", ")}. Apply reviewed migration 0025 first.`
    )
  }
}

async function loadLegacyRows(sql, filters) {
  const tenantFilter = filters.tenantId
    ? sql`and da.tenant_id = ${filters.tenantId}::uuid`
    : sql``
  const locationFilter = filters.locationId
    ? sql`and da.location_id = ${filters.locationId}::uuid`
    : sql``

  const assignments = await sql`
    select
      da.id as assignment_id,
      da.tenant_id,
      da.location_id,
      da.resource_id,
      da.device_id,
      da.role,
      da.config
    from device_assignments da
    where da.role = 'venue_edge'
      and da.effective_from <= now()
      and (da.effective_to is null or da.effective_to > now())
      ${tenantFilter}
      ${locationFilter}
    order by da.tenant_id, da.location_id, da.id
  `

  if (assignments.length === 0) {
    return { assignments: [], devices: [], resources: [] }
  }

  const tenantIds = [...new Set(assignments.map((row) => row.tenant_id))]
  const devices = await sql`
    select id, tenant_id, location_id, type
    from devices
    where tenant_id in ${sql(tenantIds)}
  `
  const resources = await sql`
    select id, tenant_id, location_id, name
    from resources
    where tenant_id in ${sql(tenantIds)}
  `

  return {
    assignments: assignments.map((row) => ({
      assignmentId: row.assignment_id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      resourceId: row.resource_id,
      deviceId: row.device_id,
      role: row.role,
      config: row.config,
    })),
    devices: devices.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      type: row.type,
    })),
    resources: resources.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      name: row.name,
    })),
  }
}

async function applyPlan(sql, plan) {
  return applyLegacyVenueEdgeTopologyPlan(sql, plan)
}

function printReport(summary, skipped, inserted, asJson) {
  const report = {
    mode: inserted ? "apply" : "dry-run",
    ...summary,
    inserted: inserted ?? undefined,
    skipped,
    configPublished: false,
  }
  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`VenueEdge legacy topology ${report.mode}`)
  for (const [key, value] of Object.entries(summary)) {
    console.log(
      `  ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`
    )
  }
  if (inserted) {
    console.log(`  inserted: ${JSON.stringify(inserted)}`)
  }
  console.log("  configPublished: false")
  console.log(
    "  nextAction: enter NVR credentials on the venue PC, review topology, then publish Config v2"
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (options.apply && !options.confirmed) {
    throw new Error(`--apply requires ${APPLY_CONFIRMATION}.`)
  }

  const sql = postgres(requireDatabaseUrl(), { max: 1, prepare: false })
  try {
    await assertFoundationExists(sql)
    const rows = await loadLegacyRows(sql, options)
    const plan = planLegacyVenueEdgeTopology(rows)
    const summary = summarizeLegacyVenueEdgePlan(plan)
    const inserted = options.apply ? await applyPlan(sql, plan) : null
    printReport(summary, plan.skipped, inserted, options.json)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
