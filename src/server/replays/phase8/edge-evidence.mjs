import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const venueEdgeRoot = join(moduleDir, "../../../../services/venue-edge")

export function loadSingleVenueSimulatorEvidence() {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/evaluate-single-venue-evidence.mjs"],
    {
      cwd: venueEdgeRoot,
      encoding: "utf8",
    },
  )

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        "Failed to evaluate single-venue simulator evidence.",
    )
  }

  return JSON.parse(result.stdout.trim())
}
