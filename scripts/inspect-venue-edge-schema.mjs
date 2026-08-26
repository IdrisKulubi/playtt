#!/usr/bin/env node
import postgres from "postgres"

import { PHASE5_TABLES } from "./lib/phase5-schema-expectations.mjs"

const VENUE_EDGE_TABLES = [
  "replay_camera_sources",
  "replay_capture_attempts",
  "replay_recorders",
  "replay_source_health",
  "replay_source_policies",
  "replay_source_routes",
  "venue_edge_config_applications",
  "venue_edge_config_revisions",
  "venue_edge_installations",
  "venue_edge_secret_refs",
]

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!databaseUrl) throw new Error("POSTGRES_URL is required")
  return databaseUrl
}

async function tableExists(sql, tableName) {
  const [row] = await sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = 'public' and table_name = ${tableName}
    limit 1
  `
  return Boolean(row)
}

async function columnExists(sql, tableName, columnName) {
  const [row] = await sql`
    select 1 as ok
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${tableName}
      and column_name = ${columnName}
    limit 1
  `
  return Boolean(row)
}

async function indexExists(sql, name) {
  const [row] = await sql`
    select 1 as ok
    from pg_indexes
    where schemaname = 'public' and indexname = ${name}
    limit 1
  `
  return Boolean(row)
}

const sql = postgres(requireDatabaseUrl(), { max: 1 })

try {
  console.log("Phase 5 tables:")
  for (const tableName of PHASE5_TABLES) {
    console.log(`  ${tableName}: ${(await tableExists(sql, tableName)) ? "ok" : "missing"}`)
  }

  console.log("\nVenue edge tables:")
  let venueEdgeComplete = true
  for (const tableName of VENUE_EDGE_TABLES) {
    const ok = await tableExists(sql, tableName)
    if (!ok) venueEdgeComplete = false
    console.log(`  ${tableName}: ${ok ? "ok" : "missing"}`)
  }

  console.log("\nReplay request columns:")
  for (const columnName of ["config_revision_id", "selected_camera_source_id"]) {
    const ok = await columnExists(sql, "replay_requests", columnName)
    if (!ok) venueEdgeComplete = false
    console.log(`  replay_requests.${columnName}: ${ok ? "ok" : "missing"}`)
  }

  console.log("\nComposite indexes required by 0025:")
  for (const indexName of [
    "devices_tenant_location_id_unique",
    "replay_requests_tenant_location_id_unique",
    "resources_tenant_location_id_unique",
  ]) {
    const ok = await indexExists(sql, indexName)
    if (!ok) venueEdgeComplete = false
    console.log(`  ${indexName}: ${ok ? "ok" : "missing"}`)
  }

  console.log(`\nVenue edge migration complete: ${venueEdgeComplete ? "yes" : "no"}`)
} finally {
  await sql.end({ timeout: 5 })
}
