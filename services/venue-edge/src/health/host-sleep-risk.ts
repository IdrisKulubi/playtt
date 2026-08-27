import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface HostSleepRiskSnapshot {
  hostSleepRisk: boolean
  hostSleepRiskReason: string | null
}

export async function detectHostSleepRisk(): Promise<HostSleepRiskSnapshot> {
  if (process.platform !== "win32") {
    return { hostSleepRisk: false, hostSleepRiskReason: null }
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `
Add-Type -AssemblyName System.Windows.Forms
$onBattery = [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus -eq 'Offline'
@{ onBattery = $onBattery } | ConvertTo-Json -Compress
`,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    )

    const parsed = JSON.parse(stdout.trim()) as { onBattery?: boolean }

    if (parsed.onBattery) {
      return {
        hostSleepRisk: true,
        hostSleepRiskReason:
          "Venue PC is on battery power. Connect AC power and disable sleep to keep capture running.",
      }
    }

    return { hostSleepRisk: false, hostSleepRiskReason: null }
  } catch {
    return {
      hostSleepRisk: false,
      hostSleepRiskReason: null,
    }
  }
}
