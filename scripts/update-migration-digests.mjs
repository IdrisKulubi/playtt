import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const manifestPath = join(root, "drizzle", "migration-integrity.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

for (const tag of [
  "0023_phase5_ttlock_inventory",
  "0024_phase5_notifications_relays",
  "0025_phase1_venue_edge_sources",
]) {
  const filePath = join(root, "drizzle", `${tag}.sql`)
  manifest.migrations[tag] = {
    sha256: createHash("sha256").update(readFileSync(filePath)).digest("hex"),
  }
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
console.log("Updated migration digests for 0023-0025")
