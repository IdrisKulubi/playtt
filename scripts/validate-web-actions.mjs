import { resolve } from "node:path"

import { validateWebActionContracts } from "./lib/web-actions-contracts.mjs"

const result = validateWebActionContracts(resolve(process.cwd()))

for (const item of result.findings) {
  console.error(`[${item.code}] ${item.path} - ${item.message}`)
}

if (result.findings.length > 0) {
  console.error(
    `Web action contract validation failed with ${result.findings.length} finding(s).`,
  )
  process.exitCode = 1
} else {
  console.log(
    `Web action contracts valid: ${result.actionCount} action(s), ${result.fixtureCount} fixture(s).`,
  )
}
