import { readFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) throw new Error("POSTGRES_URL required")
  return url
}

const root = process.cwd()
const sql = postgres(getDatabaseUrl(), { max: 1 })

async function runStatements(filePath, label) {
  const content = readFileSync(filePath, "utf8")
  const statements = content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

  console.log(`${label}: ${statements.length} statements`)
  for (const statement of statements) {
    try {
      await sql.unsafe(statement)
    } catch (error) {
      const code = error?.code
      if (
        code === "42710" ||
        code === "42P07" ||
        code === "42701" ||
        code === "23505"
      ) {
        console.log(`  skip (exists): ${statement.slice(0, 60)}...`)
        continue
      }
      throw error
    }
  }
}

try {
  await runStatements(
    join(root, "drizzle", "0009_tenant_scope_enforce.sql"),
    "0009",
  )
  await runStatements(
    join(root, "drizzle", "0010_tenant_composite_fks.sql"),
    "0010",
  )
  console.log("Tenant enforcement migrations applied.")
} finally {
  await sql.end({ timeout: 5 })
}
