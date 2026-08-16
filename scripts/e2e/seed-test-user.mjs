import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

export const E2E_SESSION_COOKIE_NAME = "better-auth.session_token"
export const E2E_SESSION_TOKEN = "e2e-test-session-token-fixed"
export const E2E_USER_EMAIL = "e2e@playtt.test"

async function main() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()

  if (!databaseUrl) {
    console.error("POSTGRES_URL is required to seed the E2E test user.")
    process.exit(1)
  }

  const sql = postgres(databaseUrl, { max: 1 })

  try {
    await sql.unsafe(readFileSync(join(root, "db", "seed-test-e2e.sql"), "utf8"))
    console.log(
      JSON.stringify(
        {
          userEmail: E2E_USER_EMAIL,
          sessionCookieName: E2E_SESSION_COOKIE_NAME,
          sessionToken: E2E_SESSION_TOKEN,
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
