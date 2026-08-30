import { execFile } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export async function extractZipArchive(
  zipPath: string,
  destinationDir: string,
): Promise<void> {
  await mkdir(destinationDir, { recursive: true })

  if (process.platform === "win32") {
    const escapedZip = zipPath.replace(/'/g, "''")
    const escapedDest = destinationDir.replace(/'/g, "''")
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`,
    ])
    return
  }

  await execFileAsync("unzip", ["-o", zipPath, "-d", destinationDir])
}
