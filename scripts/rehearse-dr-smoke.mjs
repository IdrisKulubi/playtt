import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import process from "node:process"

const repoRoot = join(import.meta.dirname, "..")
const reportPath =
  process.env.DR_REHEARSAL_REPORT_PATH ??
  join(repoRoot, "tmp", "dr-rehearsal-report.json")

const steps = [
  { name: "ops:verify-env", command: ["pnpm", "ops:verify-env"] },
  { name: "test:operations", command: ["pnpm", "test:operations"] },
  { name: "db:validate:strict", command: ["pnpm", "db:validate:strict"] },
]

const results = []
let failed = false

for (const step of steps) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  })

  const success = result.status === 0
  if (!success) {
    failed = true
  }

  results.push({
    name: step.name,
    success,
    startedAt,
    exitCode: result.status,
    stdout: result.stdout?.slice(-4000) ?? "",
    stderr: result.stderr?.slice(-4000) ?? "",
  })

  console.log(`[${success ? "PASS" : "FAIL"}] ${step.name}`)
}

const report = {
  generatedAt: new Date().toISOString(),
  success: !failed,
  results,
}

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
console.log(`Report written to ${reportPath}`)

if (failed) {
  process.exitCode = 1
}
