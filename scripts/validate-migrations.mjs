import { resolve } from "node:path"

import {
  classifyFindings,
  validateMigrationRepository,
} from "./lib/migration-integrity.mjs"

const strict = process.argv.includes("--strict")
const rootDirectory = resolve(process.cwd())
const result = validateMigrationRepository(rootDirectory)
const classified = classifyFindings(result, { strict })

if (!strict) {
  for (const item of classified.acknowledged) {
    console.warn(`[acknowledged] ${item.key} - ${item.message}`)
  }
}

for (const item of classified.blocking) {
  console.error(`[error] ${item.key} - ${item.message}`)
}

if (classified.blocking.length > 0) {
  console.error(
    `Migration validation failed with ${classified.blocking.length} blocking finding(s).`
  )
  process.exitCode = 1
} else if (classified.acknowledged.length > 0) {
  console.log(
    `Migration integrity passed with ${classified.acknowledged.length} acknowledged metadata drift finding(s). Run db:validate:strict to keep the repair blocker visible.`
  )
} else {
  console.log("Migration integrity passed with no drift.")
}
