import { readFileSync } from "node:fs"
import { neon } from "@neondatabase/serverless"

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional file
  }
}

loadEnvLocal()

const url = process.env.POSTGRES_URL
if (!url) {
  console.error("POSTGRES_URL missing in .env.local")
  process.exit(1)
}

const sql = neon(url)
const [{ count }] = await sql`SELECT count(*)::int AS count FROM replays`
const sample = await sql`
  SELECT r.id, r.user_id, r.status, r.requested_at, l.name AS location_name
  FROM replays r
  INNER JOIN locations l ON l.id = r.location_id
  ORDER BY r.requested_at DESC
  LIMIT 5
`

const userId = process.argv[2]
let userCount = count
if (userId) {
  const [{ user_count }] = await sql`
    SELECT count(*)::int AS user_count FROM replays WHERE user_id = ${userId}
  `
  userCount = user_count
  console.log("replays_for_user:", userId, user_count)
}

console.log("replays_in_db_total:", count)
console.log("latest_sample:", JSON.stringify(sample, null, 2))
