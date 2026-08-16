import { resolve } from "node:path"

import { validateApiContracts } from "./lib/api-contracts.mjs"

const result = validateApiContracts(resolve(process.cwd()))

for (const item of result.findings) {
  console.error(`[${item.code}] ${item.path} - ${item.message}`)
}

if (result.findings.length > 0) {
  console.error(
    `Mobile API contract validation failed with ${result.findings.length} finding(s).`,
  )
  process.exitCode = 1
} else {
  console.log(
    `Mobile API contracts valid: ${result.endpointCount} endpoint(s), ${result.fixtureCount} fixture(s).`,
  )
}
