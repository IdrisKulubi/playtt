import type { IncomingMessage } from "node:http"

const FORWARDED_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
] as const

export type SetupSecurityCheckResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string }

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().split(",")[0]?.trim() ?? ""
}

function isAllowedLoopbackHost(hostHeader: string, port: number): boolean {
  const host = normalizeHost(hostHeader)
  if (!host) {
    return false
  }

  const allowed = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    "127.0.0.1",
    "localhost",
  ])

  return allowed.has(host)
}

function isAllowedLoopbackOrigin(origin: string, port: number): boolean {
  const normalized = origin.trim().toLowerCase()
  const allowed = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ])

  return allowed.has(normalized)
}

export function extractSetupToken(
  req: IncomingMessage,
  url: URL,
): string | null {
  const header = req.headers["x-venueedge-setup-token"]
  if (typeof header === "string" && header.length > 0) {
    return header
  }

  const queryToken = url.searchParams.get("setup_token")
  if (queryToken && queryToken.length > 0) {
    return queryToken
  }

  return null
}

export function checkSetupSecurity(input: {
  req: IncomingMessage
  port: number
  token: string | null
  expectedToken: string | null
  sessionActive: boolean
  requireJsonContentType?: boolean
}): SetupSecurityCheckResult {
  for (const header of FORWARDED_HEADERS) {
    const value = input.req.headers[header]
    if (typeof value === "string" && value.length > 0) {
      return {
        ok: false,
        status: 403,
        message: "Forwarded headers are not accepted on the setup host.",
      }
    }
  }

  const hostHeader = input.req.headers.host ?? ""
  if (!isAllowedLoopbackHost(hostHeader, input.port)) {
    return {
      ok: false,
      status: 403,
      message: "Setup host requests must target loopback.",
    }
  }

  const origin = input.req.headers.origin
  if (typeof origin === "string" && origin.length > 0) {
    if (!isAllowedLoopbackOrigin(origin, input.port)) {
      return {
        ok: false,
        status: 403,
        message: "Origin is not allowed for the setup host.",
      }
    }
  }

  if (!input.sessionActive) {
    return {
      ok: false,
      status: 401,
      message: "Setup session is locked or expired.",
    }
  }

  if (!input.token || !input.expectedToken || input.token !== input.expectedToken) {
    return {
      ok: false,
      status: 401,
      message: "Setup token is missing or invalid.",
    }
  }

  if (input.requireJsonContentType) {
    const contentType = input.req.headers["content-type"] ?? ""
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return {
        ok: false,
        status: 403,
        message: "JSON content type is required.",
      }
    }
  }

  return { ok: true }
}
