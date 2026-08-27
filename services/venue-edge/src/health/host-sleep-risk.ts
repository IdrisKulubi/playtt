import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface HostSleepRiskSnapshot {
  hostSleepRisk: boolean
  hostSleepRiskReason: string | null
}

export interface WindowsPowerSnapshot {
  onBattery?: boolean
  acSleepSeconds?: number
  acHibernateSeconds?: number
}

export function assessWindowsPowerSnapshot(parsed: WindowsPowerSnapshot): HostSleepRiskSnapshot {
  if (parsed.onBattery) {
    return {
      hostSleepRisk: true,
      hostSleepRiskReason:
        "Venue PC is on battery power. Connect AC power and disable sleep to keep capture running.",
    }
  }
  const enabledPolicies = [
    [parsed.acSleepSeconds, "sleep"],
    [parsed.acHibernateSeconds, "hibernate"],
  ].filter(([seconds]) => typeof seconds === "number" && seconds > 0)
  if (enabledPolicies.length > 0) {
    return {
      hostSleepRisk: true,
      hostSleepRiskReason: `Windows ${enabledPolicies.map(([, name]) => name).join(" and ")} is enabled on AC power. Set it to Never so capture remains available.`,
    }
  }
  return { hostSleepRisk: false, hostSleepRiskReason: null }
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
$scheme = (powercfg /getactivescheme) -join ''
$sleep = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE) -join [Environment]::NewLine
$hibernate = (powercfg /query SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE) -join [Environment]::NewLine
function Get-AcSeconds([string] $text) {
  $match = [regex]::Match($text, 'Current AC Power Setting Index:\s+0x([0-9a-fA-F]+)')
  if ($match.Success) { return [Convert]::ToInt32($match.Groups[1].Value, 16) }
  return $null
}
@{ onBattery = $onBattery; acSleepSeconds = Get-AcSeconds $sleep; acHibernateSeconds = Get-AcSeconds $hibernate } | ConvertTo-Json -Compress
`,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    )

    return assessWindowsPowerSnapshot(JSON.parse(stdout.trim()) as WindowsPowerSnapshot)
  } catch {
    return {
      hostSleepRisk: true,
      hostSleepRiskReason: "Windows power policy could not be verified. Confirm that sleep and hibernate are disabled.",
    }
  }
}
