import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import { assertPhase2CloneMatchesEmptyReplay } from "./lib/phase2-replay.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const drizzleDirectory = join(root, "drizzle")

let url = process.env.POSTGRES_URL
if (!url) {
  console.error(
    "POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/replay-phase2-clone.mjs",
  )
  process.exit(1)
}

url = url.replace(/^['"]+|['"]+$/g, "").trim()

const sql = postgres(url, { max: 1 })

try {
  const result = await assertPhase2CloneMatchesEmptyReplay(
    sql,
    root,
    drizzleDirectory,
  )

  console.log(
    JSON.stringify(
      {
        digest: result.digest,
        emptyMigrationCount: result.emptyFiles,
        cloneMigrationCount: result.cloneFiles,
        phase2CloneMatchesEmptyReplay: true,
      },
      null,
      2,
    ),
  )
} finally {
  await sql.end({ timeout: 5 })
}
