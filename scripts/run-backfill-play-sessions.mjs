import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

let url = process.env.POSTGRES_URL
if (!url) {
  console.error(
    "POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/run-backfill-play-sessions.mjs",
  )
  process.exit(1)
}

url = url.replace(/^['"]+|['"]+$/g, "").trim()

const sql = postgres(url, { max: 1 })
const backfillFile = readFileSync(
  join(root, "db", "backfill-play-sessions.sql"),
  "utf8",
)

await sql.unsafe(backfillFile)

const [counts] = await sql`
  select
    (select count(*)::int from play_sessions) as play_sessions,
    (select count(*)::int from session_participants) as participants,
    (
      select count(*)::int
      from bookings
      where status in ('confirmed', 'completed')
        and payment_status = 'paid'
    ) as eligible_bookings
`

await sql.end()

console.log("Backfill complete: db/backfill-play-sessions.sql")
console.log(counts)
