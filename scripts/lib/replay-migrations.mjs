import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const SQL_FILE_PATTERN = /^(\d{4})_(.+)\.sql$/

export function listMigrationSqlFiles(drizzleDirectory) {
  return readdirSync(drizzleDirectory)
    .filter((file) => SQL_FILE_PATTERN.test(file))
    .sort()
}

export function readMigrationStatements(drizzleDirectory, fileName) {
  const raw = readFileSync(join(drizzleDirectory, fileName), "utf8")
  return raw
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

export async function applyMigrationFiles(sql, drizzleDirectory, fileNames) {
  for (const fileName of fileNames) {
    const statements = readMigrationStatements(drizzleDirectory, fileName)
    for (const statement of statements) {
      await sql.unsafe(statement)
    }
  }
}

export async function applyCanonicalMigrations(sql, drizzleDirectory) {
  const files = listMigrationSqlFiles(drizzleDirectory)
  await applyMigrationFiles(sql, drizzleDirectory, files)
  return files
}
