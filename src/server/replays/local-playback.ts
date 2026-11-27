/**
 * Venue-LAN playback: the edge serves a freshly cut clip from the venue PC so
 * the table's TV can start it before the R2 upload finishes. The cloud only
 * relays the links; it accepts nothing that could point a TV elsewhere.
 */

export interface LocalPlaybackReport {
  urls: string[]
  expiresAt: string
  durationSeconds?: number
}

/** Links are only kept this long, however long the edge says they last. */
export const MAX_LOCAL_PLAYBACK_TTL_MS = 30 * 60_000
const MAX_LOCAL_PLAYBACK_URLS = 4
const CLIP_PATH = /^\/clips\/[A-Za-z0-9_-]{20,128}\.mp4$/

function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (hostname === "localhost") {
    return true
  }

  const parts = hostname.split(".")
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) {
    return false
  }

  const [a, b] = parts.map(Number) as [number, number, number, number]
  if (parts.some((part) => Number(part) > 255)) {
    return false
  }

  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

/** One venue-LAN clip link: http(s), private/loopback IPv4, /clips/<key>.mp4. */
export function isAllowedLocalPlaybackUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    isPrivateOrLoopbackHost(url.hostname) &&
    CLIP_PATH.test(url.pathname)
  )
}

/**
 * Keeps only valid links and caps the expiry. Returns null when nothing
 * usable is left (the TV then waits for R2 as before).
 */
export function sanitizeLocalPlaybackReport(
  report: LocalPlaybackReport,
  nowMs: number
): LocalPlaybackReport | null {
  const urls = [...new Set(report.urls)]
    .filter(isAllowedLocalPlaybackUrl)
    .slice(0, MAX_LOCAL_PLAYBACK_URLS)
  const expiresAtMs = Date.parse(report.expiresAt)

  if (urls.length === 0 || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return null
  }

  const durationSeconds =
    typeof report.durationSeconds === "number" &&
    report.durationSeconds > 0 &&
    report.durationSeconds <= 300
      ? report.durationSeconds
      : undefined

  return {
    urls,
    expiresAt: new Date(
      Math.min(expiresAtMs, nowMs + MAX_LOCAL_PLAYBACK_TTL_MS)
    ).toISOString(),
    ...(durationSeconds ? { durationSeconds } : {}),
  }
}

/** The links to hand the TV, or null once they've expired. */
export function activeLocalPlayback(
  localPlayback: LocalPlaybackReport | null | undefined,
  nowMs: number
): LocalPlaybackReport | null {
  if (!localPlayback) {
    return null
  }

  const expiresAtMs = Date.parse(localPlayback.expiresAt)
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs
    ? localPlayback
    : null
}
