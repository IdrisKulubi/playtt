#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  orderMigrationStatements,
  parseMigrationStatements,
} from "./lib/phase5-schema-expectations.mjs"

const root = process.cwd()
const targets = process.argv.slice(2)

const migrationFiles =
  targets.length > 0
    ? targets
    : [
        "0023_phase5_ttlock_inventory.sql",
        "0024_phase5_notifications_relays.sql",
        "0025_phase1_venue_edge_sources.sql",
      ]

for (const fileName of migrationFiles) {
  const filePath = join(root, "drizzle", fileName)
  const content = readFileSync(filePath, "utf8")
  const ordered = orderMigrationStatements(parseMigrationStatements(content))
  const next = ordered
    .map((statement) => `${statement.trim()}`)
    .join("--> statement-breakpoint\n")
    .concat("\n")

  writeFileSync(filePath, next, "utf8")
  console.log(`Reordered ${fileName} (${ordered.length} statements)`)
}
