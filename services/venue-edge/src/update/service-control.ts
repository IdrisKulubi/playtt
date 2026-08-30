import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { isInstalledLayout, resolveInstallRoot } from "../config/install-layout"

const execFileAsync = promisify(execFile)

export async function restartInstalledVenueEdgeService(): Promise<void> {
  if (!isInstalledLayout()) {
    return
  }

  const installRoot = resolveInstallRoot()
  if (!installRoot) {
    return
  }

  const serviceWrapper = `${installRoot}\\PlayTTVenueEdge.exe`
  await execFileAsync(serviceWrapper, ["restart"], {
    windowsHide: true,
  })
}

export async function probeVenueEdgeHealth(): Promise<boolean> {
  return true
}
