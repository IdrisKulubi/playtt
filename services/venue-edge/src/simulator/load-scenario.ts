import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { parseSimulatorScenario, type SimulatorScenario } from "./scenario"

export async function loadSimulatorScenario(
  dataDir: string,
): Promise<SimulatorScenario | null> {
  try {
    const raw = await readFile(join(dataDir, "simulator-scenario.json"), "utf8")
    return parseSimulatorScenario(JSON.parse(raw))
  } catch {
    return null
  }
}
