import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) throw new Error("POSTGRES_URL required")
  return url
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

const root = process.cwd()
const drizzleDirectory = join(root, "drizzle")
const journal = JSON.parse(
  readFileSync(join(drizzleDirectory, "meta", "_journal.json"), "utf8"),
)
const sql = postgres(getDatabaseUrl(), { max: 1 })

try {
  const applied = await sql`
    select hash from drizzle.__drizzle_migrations
  `
  const appliedHashes = new Set(applied.map((row) => row.hash))
  const inserted = []

  for (const entry of journal.entries) {
    const filePath = join(drizzleDirectory, `${entry.tag}.sql`)
    const hash = sha256(filePath)

    if (appliedHashes.has(hash)) {
      continue
    }

    await sql`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${entry.when})
    `
    inserted.push(entry.tag)
    appliedHashes.add(hash)
  }

  console.log(
    JSON.stringify(
      {
        inserted,
        totalJournalEntries: journal.entries.length,
        appliedCount: appliedHashes.size,
      },
      null,
      2,
    ),
  )
} finally {
  await sql.end({ timeout: 5 })
}
