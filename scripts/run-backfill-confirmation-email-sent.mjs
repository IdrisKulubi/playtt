import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

let url = process.env.POSTGRES_URL
if (!url) {
  console.error(
    "POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/run-backfill-confirmation-email-sent.mjs",
  )
  process.exit(1)
}

url = url.replace(/^['"]+|['"]+$/g, "").trim()

const sql = postgres(url, { max: 1 })
const backfillFile = readFileSync(
  join(root, "db", "backfill-confirmation-email-sent.sql"),
  "utf8",
)

await sql.unsafe(backfillFile)

const [counts] = await sql`
  select
    count(*) filter (where status = 'sent')::int as sent,
    count(*) filter (where status = 'pending')::int as pending
  from notifications
  where channel = 'email'
    and template_key = 'booking_confirmed'
`

await sql.end()

console.log("Backfill complete: db/backfill-confirmation-email-sent.sql")
console.log(counts)
