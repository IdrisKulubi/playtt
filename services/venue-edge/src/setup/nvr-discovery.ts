// Finds recorders on the venue network so installers don't have to know the
// NVR's IP address. Two methods run together:
//   1. ONVIF WS-Discovery: a standard multicast probe that NVRs and IP cameras
//      answer with their address and, usually, name and model.
//   2. RTSP sweep: a quick TCP check of port 554 on the PC's own /24 subnet,
//      which also finds recorders where multicast is blocked.
// Nothing here sends credentials; it only learns addresses.

import { randomUUID } from "node:crypto"
import { createSocket } from "node:dgram"
import { connect } from "node:net"
import { networkInterfaces } from "node:os"

export interface DiscoveredRecorder {
  host: string
  rtspPort: number
  /** Name from ONVIF scopes, if the device announced one. */
  name: string | null
  /** Hardware/model from ONVIF scopes, if announced. */
  model: string | null
  /** True when the device looks like a recorder rather than a single camera. */
  likelyRecorder: boolean
  /** True when the RTSP port answered. */
  rtspOpen: boolean
  foundBy: Array<"onvif" | "rtsp_sweep">
}

const WS_DISCOVERY_ADDRESS = "239.255.255.250"
const WS_DISCOVERY_PORT = 3702
const RTSP_PORT = 554

function probeMessage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:${randomUUID()}</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`
}

function decodeScope(value: string) {
  try {
    return decodeURIComponent(value).replace(/_/g, " ").trim()
  } catch {
    return value.trim()
  }
}

/** Parses one WS-Discovery ProbeMatch reply. Exported for tests. */
export function parseProbeMatch(xml: string): { host: string; name: string | null; model: string | null; recorder: boolean } | null {
  const xaddrs = xml.match(/<[^>]*XAddrs[^>]*>([^<]+)</i)?.[1]
  if (!xaddrs) return null
  let host: string | null = null
  for (const candidate of xaddrs.trim().split(/\s+/)) {
    try {
      const url = new URL(candidate)
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) {
        host = url.hostname
        break
      }
    } catch {
      // Ignore malformed address.
    }
  }
  if (!host) return null

  const scopes = xml.match(/<[^>]*Scopes[^>]*>([^<]+)</i)?.[1] ?? ""
  const scope = (kind: string) => {
    const match = scopes.match(new RegExp(`onvif://www\\.onvif\\.org/${kind}/([^\\s]+)`, "i"))
    return match ? decodeScope(match[1]) : null
  }
  const name = scope("name")
  const model = scope("hardware")
  const type = scope("type") ?? ""
  const recorder = /nvr|dvr|recorder/i.test(`${type} ${model ?? ""} ${name ?? ""}`)
  return { host, name, model, recorder }
}

function wsDiscover(timeoutMs: number): Promise<Map<string, { name: string | null; model: string | null; recorder: boolean }>> {
  return new Promise((resolve) => {
    const found = new Map<string, { name: string | null; model: string | null; recorder: boolean }>()
    let socket: ReturnType<typeof createSocket>
    try {
      socket = createSocket({ type: "udp4", reuseAddr: true })
    } catch {
      resolve(found)
      return
    }
    const finish = () => {
      try {
        socket.close()
      } catch {
        // Already closed.
      }
      resolve(found)
    }
    socket.on("error", finish)
    socket.on("message", (buffer) => {
      const match = parseProbeMatch(buffer.toString("utf8"))
      if (match && !found.has(match.host)) {
        found.set(match.host, { name: match.name, model: match.model, recorder: match.recorder })
      }
    })
    socket.bind(0, () => {
      try {
        socket.setMulticastTTL(2)
        const message = Buffer.from(probeMessage(), "utf8")
        // Send twice: UDP multicast is lossy.
        socket.send(message, WS_DISCOVERY_PORT, WS_DISCOVERY_ADDRESS)
        setTimeout(() => socket.send(message, WS_DISCOVERY_PORT, WS_DISCOVERY_ADDRESS), 400)
      } catch {
        // Multicast blocked; the RTSP sweep still runs.
      }
      setTimeout(finish, timeoutMs)
    })
  })
}

function isPrivateIpv4(address: string) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
}

/** The /24 prefixes ("192.168.0") of this PC's private network adapters. */
export function localSubnetPrefixes(): string[] {
  const prefixes = new Set<string>()
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isPrivateIpv4(entry.address)) {
        prefixes.add(entry.address.split(".").slice(0, 3).join("."))
      }
    }
  }
  return [...prefixes].slice(0, 4)
}

function portOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const done = (open: boolean) => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

async function rtspSweep(prefixes: string[], timeoutMs: number, concurrency: number): Promise<Set<string>> {
  const hosts: string[] = []
  for (const prefix of prefixes) {
    for (let last = 1; last <= 254; last += 1) hosts.push(`${prefix}.${last}`)
  }
  const open = new Set<string>()
  let next = 0
  const worker = async () => {
    while (next < hosts.length) {
      const host = hosts[next++]
      if (await portOpen(host, RTSP_PORT, timeoutMs)) open.add(host)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker))
  return open
}

export async function discoverRecorders(options?: {
  onvifTimeoutMs?: number
  sweepTimeoutMs?: number
  sweepConcurrency?: number
}): Promise<DiscoveredRecorder[]> {
  const [onvif, rtsp] = await Promise.all([
    wsDiscover(options?.onvifTimeoutMs ?? 3000),
    rtspSweep(localSubnetPrefixes(), options?.sweepTimeoutMs ?? 700, options?.sweepConcurrency ?? 64),
  ])

  const results = new Map<string, DiscoveredRecorder>()
  for (const [host, info] of onvif) {
    results.set(host, {
      host,
      rtspPort: RTSP_PORT,
      name: info.name,
      model: info.model,
      likelyRecorder: info.recorder,
      rtspOpen: rtsp.has(host),
      foundBy: ["onvif"],
    })
  }
  for (const host of rtsp) {
    const existing = results.get(host)
    if (existing) {
      existing.foundBy.push("rtsp_sweep")
    } else {
      results.set(host, {
        host,
        rtspPort: RTSP_PORT,
        name: null,
        model: null,
        likelyRecorder: false,
        rtspOpen: true,
        foundBy: ["rtsp_sweep"],
      })
    }
  }

  // Recorders first, then anything with a name, then by address.
  const ipValue = (host: string) => host.split(".").reduce((sum, part) => sum * 256 + Number(part), 0)
  return [...results.values()].sort(
    (a, b) =>
      Number(b.likelyRecorder) - Number(a.likelyRecorder) ||
      Number(Boolean(b.name)) - Number(Boolean(a.name)) ||
      ipValue(a.host) - ipValue(b.host),
  )
}
