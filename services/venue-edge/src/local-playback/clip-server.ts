import { randomBytes } from "node:crypto"
import { createReadStream } from "node:fs"
import { copyFile, mkdir, readdir, rm, stat, unlink } from "node:fs/promises"
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import { networkInterfaces } from "node:os"
import { join } from "node:path"

import { safeLog } from "../health/metrics"

/**
 * Serves freshly cut clips to the venue's TVs over the local network, so a
 * TV can start a replay before the R2 upload finishes.
 *
 * Deliberately tiny and read-only: it only serves files it published itself,
 * each under a random 192-bit key, for a few minutes. Nothing else on the PC
 * (setup pages, buffers, credentials) is reachable through it.
 */

export const LOCAL_CLIP_TTL_MS = 15 * 60_000
const MAX_LOCAL_CLIPS = 40
const SWEEP_INTERVAL_MS = 60_000
const CLIP_PATH = /^\/clips\/([A-Za-z0-9_-]{32})\.mp4$/

export interface LocalClipPublication {
  urls: string[]
  expiresAt: string
  durationSeconds?: number
}

interface LocalClip {
  path: string
  expiresAtMs: number
}

export interface LocalClipServerOptions {
  directory: string
  /** 0 picks a free port (tests). */
  port: number
  /** Host to put in links instead of the PC's detected LAN address. */
  advertisedHost?: string | null
  ttlMs?: number
  now?: () => number
  /** Override LAN address detection (tests). */
  lanAddresses?: () => string[]
}

function isPrivateIpv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number) as [number, number]
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  )
}

/** The PC's private IPv4 addresses (wired/Wi-Fi), most likely first. */
export function detectLanAddresses(): string[] {
  const addresses: string[] = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        isPrivateIpv4(entry.address) &&
        !addresses.includes(entry.address)
      ) {
        addresses.push(entry.address)
      }
    }
  }
  // 192.168.x first: it's what venue routers hand out.
  return addresses.sort(
    (left, right) =>
      Number(!left.startsWith("192.168.")) - Number(!right.startsWith("192.168."))
  )
}

export class LocalClipServer {
  private server: Server | null = null
  private sweepTimer: NodeJS.Timeout | null = null
  private readonly clips = new Map<string, LocalClip>()
  private readonly now: () => number
  private readonly ttlMs: number

  constructor(private readonly options: LocalClipServerOptions) {
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? LOCAL_CLIP_TTL_MS
  }

  isRunning(): boolean {
    return this.server?.listening ?? false
  }

  getPort(): number | null {
    const address = this.server?.address()
    return address && typeof address === "object"
      ? (address as AddressInfo).port
      : null
  }

  async start(): Promise<void> {
    if (this.server) {
      return
    }

    // Keys live in memory, so clips from a previous run can never be served.
    await rm(this.options.directory, { recursive: true, force: true })
    await mkdir(this.options.directory, { recursive: true })

    const server = createServer((req, res) => {
      void this.handle(req, res).catch(() => {
        if (!res.headersSent) {
          res.writeHead(500)
        }
        res.end()
      })
    })

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      // All interfaces: the TVs are other devices on the venue network.
      server.listen(this.options.port, "0.0.0.0", () => {
        server.off("error", reject)
        resolve()
      })
    })

    this.server = server
    this.sweepTimer = setInterval(() => {
      void this.sweep()
    }, SWEEP_INTERVAL_MS)
    this.sweepTimer.unref?.()

    safeLog("info", "Local clip server listening", {
      port: this.getPort(),
      hosts: this.advertisedHosts(),
    })
  }

  async stop(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
    const server = this.server
    this.server = null
    if (server) {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }

  /**
   * Copies the clip into the server's folder under a new random key and
   * returns the links a TV can use. Null when the server isn't running.
   */
  async publish(
    sourcePath: string,
    durationSeconds?: number
  ): Promise<LocalClipPublication | null> {
    const port = this.getPort()
    if (!port) {
      return null
    }

    const key = randomBytes(24).toString("base64url")
    const path = join(this.options.directory, `${key}.mp4`)
    await copyFile(sourcePath, path)

    const expiresAtMs = this.now() + this.ttlMs
    this.clips.set(key, { path, expiresAtMs })
    await this.enforceLimit()

    return {
      urls: this.advertisedHosts().map(
        (host) => `http://${host}:${port}/clips/${key}.mp4`
      ),
      expiresAt: new Date(expiresAtMs).toISOString(),
      ...(durationSeconds && durationSeconds > 0 ? { durationSeconds } : {}),
    }
  }

  /** LAN address(es) for TVs, then loopback for a browser on this PC. */
  private advertisedHosts(): string[] {
    const lan = this.options.advertisedHost?.trim()
      ? [this.options.advertisedHost.trim()]
      : (this.options.lanAddresses ?? detectLanAddresses)().slice(0, 2)
    return [...lan, "127.0.0.1"]
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("X-Content-Type-Options", "nosniff")

    if (req.method === "OPTIONS") {
      // Chrome asks before a public page loads from the local network.
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, HEAD",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Allow-Private-Network": "true",
        "Access-Control-Max-Age": "600",
      })
      res.end()
      return
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD, OPTIONS" })
      res.end()
      return
    }

    const pathname = (req.url ?? "").split("?")[0] ?? ""
    const key = CLIP_PATH.exec(pathname)?.[1]
    const clip = key ? this.clips.get(key) : undefined

    if (!key || !clip || clip.expiresAtMs <= this.now()) {
      res.writeHead(404)
      res.end()
      return
    }

    let size: number
    try {
      size = (await stat(clip.path)).size
    } catch {
      this.clips.delete(key)
      res.writeHead(404)
      res.end()
      return
    }

    const headers: Record<string, string | number> = {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=600",
    }

    const range = parseRange(req.headers.range, size)
    if (range === "invalid") {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` })
      res.end()
      return
    }

    const start = range?.start ?? 0
    const end = range?.end ?? size - 1
    res.writeHead(range ? 206 : 200, {
      ...headers,
      "Content-Length": end - start + 1,
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    })

    if (req.method === "HEAD" || size === 0) {
      res.end()
      return
    }

    const stream = createReadStream(clip.path, { start, end })
    stream.on("error", () => res.destroy())
    res.on("close", () => stream.destroy())
    stream.pipe(res)
  }

  private async enforceLimit(): Promise<void> {
    if (this.clips.size <= MAX_LOCAL_CLIPS) {
      return
    }
    const oldest = [...this.clips.entries()].sort(
      (left, right) => left[1].expiresAtMs - right[1].expiresAtMs
    )
    for (const [key, clip] of oldest.slice(0, this.clips.size - MAX_LOCAL_CLIPS)) {
      this.clips.delete(key)
      await unlink(clip.path).catch(() => undefined)
    }
  }

  /** Deletes expired clips (and any stray files) from disk. */
  async sweep(): Promise<void> {
    const now = this.now()
    for (const [key, clip] of this.clips) {
      if (clip.expiresAtMs <= now) {
        this.clips.delete(key)
        await unlink(clip.path).catch(() => undefined)
      }
    }

    const known = new Set([...this.clips.values()].map((clip) => clip.path))
    const files = await readdir(this.options.directory).catch(() => [])
    for (const file of files) {
      const path = join(this.options.directory, file)
      if (!known.has(path)) {
        await unlink(path).catch(() => undefined)
      }
    }
  }
}

/** A single "bytes=a-b" range; null for none, "invalid" when unsatisfiable. */
export function parseRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | null | "invalid" {
  if (!header) {
    return null
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) {
    return "invalid"
  }

  let start: number
  let end: number
  if (!match[1]) {
    // Suffix range: the last N bytes.
    const suffix = Number(match[2])
    if (suffix === 0) {
      return "invalid"
    }
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  }

  if (start >= size || start > end) {
    return "invalid"
  }

  return { start, end }
}
