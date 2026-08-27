import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const INSTALL_LAYOUT_ENV = "VENUE_EDGE_INSTALL_LAYOUT"
export const INSTALL_ROOT_ENV = "VENUE_EDGE_INSTALL_ROOT"
export const DPAPI_ENTROPY_ENV = "VENUE_EDGE_DPAPI_ENTROPY_PATH"

const DEFAULT_INSTALL_ROOT = "C:\\Program Files\\PlayTT\\VenueEdge"
const DEFAULT_PROGRAM_DATA_ROOT = "C:\\ProgramData\\PlayTT\\VenueEdge"

export function isInstalledLayout(): boolean {
  return process.env[INSTALL_LAYOUT_ENV] === "installed"
}

export function resolveInstalledDataDir(): string {
  const programData = process.env.ProgramData
  if (programData) {
    return join(programData, "PlayTT", "VenueEdge")
  }

  return DEFAULT_PROGRAM_DATA_ROOT
}

export function resolveInstallRoot(): string | null {
  const configured = process.env[INSTALL_ROOT_ENV]?.trim()
  if (configured) {
    return configured
  }

  if (isInstalledLayout()) {
    return DEFAULT_INSTALL_ROOT
  }

  return null
}

export function resolveDefaultDataDir(): string {
  if (isInstalledLayout()) {
    return resolveInstalledDataDir()
  }

  return ".venue-edge-data"
}

export function resolveDpapiEntropyPath(dataDir: string): string {
  const configured = process.env[DPAPI_ENTROPY_ENV]?.trim()
  if (configured) {
    return configured
  }

  return join(dataDir, ".dpapi-entropy")
}

export type DpapiScope = "currentUser" | "localMachine"

export function resolveDpapiScope(venueMode: string): DpapiScope {
  if (isInstalledLayout()) {
    return "localMachine"
  }

  if (venueMode === "production" && process.platform === "win32") {
    return "localMachine"
  }

  return "currentUser"
}

export function readPackagedVersion(installRoot: string): string | null {
  const versionPath = join(installRoot, "version.json")
  if (!existsSync(versionPath)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(versionPath, "utf8")) as {
      version?: string
    }
    return parsed.version?.trim() || null
  } catch {
    return null
  }
}

export function resolvePackagedFirmwareVersion(
  overrides: string | undefined,
): string | null {
  if (overrides) {
    return overrides
  }

  const envVersion = process.env.VENUE_EDGE_FIRMWARE_VERSION?.trim()
  if (envVersion) {
    return envVersion
  }

  const installRoot = resolveInstallRoot()
  if (!installRoot) {
    return null
  }

  return readPackagedVersion(installRoot)
}

export function resolveBundledFfmpegPath(installRoot: string): string {
  return join(installRoot, "ffmpeg", "ffmpeg.exe")
}

export function resolveBundledFfprobePath(installRoot: string): string {
  return join(installRoot, "ffmpeg", "ffprobe.exe")
}
