import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

import {
  resolveBundledFfmpegPath,
  resolveInstallRoot,
} from "../config/install-layout"

export interface FfmpegRunOptions {
  args: string[]
  timeoutMs?: number
  signal?: AbortSignal
  logLevel?: "error" | "warning" | "info"
}

export interface FfmpegRunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  cancelled: boolean
}

export function resolveFfmpegBinary(): string {
  const configured = process.env.FFMPEG_PATH?.trim()
  if (configured) {
    return configured
  }

  const installRoot = resolveInstallRoot()
  if (installRoot) {
    const bundled = resolveBundledFfmpegPath(installRoot)
    if (existsSync(bundled)) {
      return bundled
    }
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const wingetLink = join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "WinGet",
      "Links",
      "ffmpeg.exe",
    )

    if (existsSync(wingetLink)) {
      return wingetLink
    }
  }

  return "ffmpeg"
}

export async function runFfmpeg(
  options: FfmpegRunOptions,
): Promise<FfmpegRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolveFfmpegBinary(),
      [
        "-hide_banner",
        "-loglevel",
        options.logLevel ?? "error",
        ...options.args,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    )

    let stdout = ""
    let stderr = ""
    let timedOut = false
    let cancelled = false
    let timeout: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      options.signal?.removeEventListener("abort", onAbort)
    }

    const onAbort = () => {
      cancelled = true
      child.kill("SIGTERM")
    }

    options.signal?.addEventListener("abort", onAbort, { once: true })

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true
        child.kill("SIGTERM")
      }, options.timeoutMs)
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })

    child.on("error", (error) => {
      cleanup()
      reject(error)
    })

    child.on("close", (exitCode) => {
      cleanup()
      resolve({ exitCode, stdout, stderr, timedOut, cancelled })
    })
  })
}

export function terminateProcess(child: ChildProcessWithoutNullStreams): void {
  child.kill("SIGTERM")
}
