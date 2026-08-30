import { statfs } from "node:fs"
import { execFile } from "node:child_process"
import { freemem, loadavg } from "node:os"
import { promisify } from "node:util"

import type { VenueEdgeEnv } from "./env"

const statfsAsync = promisify(statfs)
const execFileAsync = promisify(execFile)
let windowsCpuCache: { value: number; expiresAt: number } | null = null

export interface BufferStartBudgetResult {
  allowed: boolean
  reason?: string
}

export async function evaluateBufferStartBudget(
  env: VenueEdgeEnv,
  activeBufferProcesses: number
): Promise<BufferStartBudgetResult> {
  if (activeBufferProcesses >= env.maxBufferProcesses) {
    return { allowed: false, reason: "max_buffer_processes" }
  }

  const memory = evaluateMemoryBudget(env)
  if (!memory.allowed) {
    return memory
  }

  const cpu = await evaluateCpuBudget(env)
  if (!cpu.allowed) {
    return cpu
  }

  const network = evaluateNetworkBudget(env, activeBufferProcesses)
  if (!network.allowed) {
    return network
  }

  const disk = await evaluateDiskBudget(env)
  if (!disk.allowed) {
    return disk
  }

  return { allowed: true }
}

export function evaluateMemoryBudget(
  env: VenueEdgeEnv
): BufferStartBudgetResult {
  const freeBytes = freemem()

  if (freeBytes < env.minFreeMemoryBytes) {
    return { allowed: false, reason: "memory_pressure" }
  }

  return { allowed: true }
}

async function readWindowsSystemCpuPercent(): Promise<number> {
  if (windowsCpuCache && windowsCpuCache.expiresAt > Date.now()) {
    return windowsCpuCache.value
  }

  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
    ],
    { timeout: 5_000, windowsHide: true }
  )

  const value = Number(String(stdout).trim())
  if (!Number.isFinite(value)) {
    throw new Error("CPU_PROBE_INVALID")
  }
  windowsCpuCache = { value, expiresAt: Date.now() + 5_000 }
  return value
}

export async function evaluateCpuBudget(
  env: VenueEdgeEnv,
  windowsCpuReader: () => Promise<number> = readWindowsSystemCpuPercent
): Promise<BufferStartBudgetResult> {
  const [load] = loadavg()

  if (process.platform === "win32") {
    let cpuPercent: number
    try {
      cpuPercent = await windowsCpuReader()
    } catch {
      return { allowed: false, reason: "cpu_probe_unavailable" }
    }

    if (cpuPercent > env.maxCpuPercent) {
      return { allowed: false, reason: "cpu_pressure" }
    }

    return { allowed: true }
  }

  if (load > env.maxCpuLoadAverage) {
    return { allowed: false, reason: "cpu_pressure" }
  }

  return { allowed: true }
}

export function evaluateNetworkBudget(
  env: VenueEdgeEnv,
  activeBufferProcesses: number
): BufferStartBudgetResult {
  const projectedMbps =
    (activeBufferProcesses + 1) * env.estimatedSourceNetworkMbps

  if (projectedMbps > env.maxNetworkMbps) {
    return { allowed: false, reason: "network_pressure" }
  }

  return { allowed: true }
}

export async function evaluateDiskBudget(
  env: VenueEdgeEnv
): Promise<BufferStartBudgetResult> {
  try {
    const stats = await statfsAsync(env.dataDir)
    const freeBytes = Number(stats.bfree) * Number(stats.bsize)

    if (freeBytes < env.reservedFreeDiskBytes) {
      return { allowed: false, reason: "disk_pressure" }
    }
  } catch {
    return { allowed: true }
  }

  return { allowed: true }
}

export interface HostResourceMetrics {
  cpuPercent: number | null
  freeMemoryBytes: number
  diskUsageBytes: number | null
  reservedFreeDiskBytes: number
  diskPressure: boolean
}

export async function readHostResourceMetrics(
  env: VenueEdgeEnv,
  windowsCpuReader: () => Promise<number> = readWindowsSystemCpuPercent,
): Promise<HostResourceMetrics> {
  let cpuPercent: number | null = null
  if (process.platform === "win32") {
    try {
      cpuPercent = await windowsCpuReader()
    } catch {
      cpuPercent = null
    }
  } else {
    const [load] = loadavg()
    cpuPercent = Number.isFinite(load) ? Math.round(load * 100) : null
  }

  let diskUsageBytes: number | null = null
  let diskPressure = false
  try {
    const stats = await statfsAsync(env.dataDir)
    const freeBytes = Number(stats.bfree) * Number(stats.bsize)
    const totalBytes = Number(stats.blocks) * Number(stats.bsize)
    diskUsageBytes = Math.max(0, totalBytes - freeBytes)
    diskPressure = freeBytes < env.reservedFreeDiskBytes
  } catch {
    diskUsageBytes = null
  }

  return {
    cpuPercent,
    freeMemoryBytes: freemem(),
    diskUsageBytes,
    reservedFreeDiskBytes: env.reservedFreeDiskBytes,
    diskPressure,
  }
}
