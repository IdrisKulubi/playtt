import { createHash } from "node:crypto"

import { AccessProviderError } from "./errors.ts"
import type {
  AccessProvider,
  AccessProviderCredential,
  AccessProviderInventory,
  AccessProviderTarget,
} from "./types.ts"

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://api.sciener.com",
  "https://euapi.sciener.com",
])

type FetchLike = typeof fetch

interface TtlockToken {
  clientId: string
  accessToken: string
}

export interface TtlockOAuthTokenResult {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  uid: string | null
}

async function requestOAuthToken(
  baseUrl: string,
  body: URLSearchParams,
  fetchImpl: FetchLike,
  allowedOrigins?: Iterable<string>,
): Promise<TtlockOAuthTokenResult> {
  const origin = validateBaseUrl(baseUrl, allowedOrigins)
  let response: Response
  try {
    response = await fetchImpl(`${origin}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new AccessProviderError("retryable", "TTLock authentication failed.", {
      cause: error,
    })
  }
  if (!response.ok) {
    throw new AccessProviderError(
      response.status >= 500 ? "retryable" : "configuration_terminal",
      `TTLock authentication returned HTTP ${response.status}.`,
    )
  }
  const result = (await response.json()) as Record<string, unknown>
  if (!result.access_token || !result.refresh_token) {
    throw new AccessProviderError(
      "configuration_terminal",
      "TTLock authentication was rejected.",
    )
  }
  return {
    accessToken: String(result.access_token),
    refreshToken: String(result.refresh_token),
    expiresInSeconds: Number(result.expires_in) || 0,
    uid: result.uid ? String(result.uid) : null,
  }
}

export function exchangeTtlockPassword(input: {
  baseUrl?: string
  clientId: string
  clientSecret: string
  username: string
  password: string
  fetchImpl?: FetchLike
  allowedOrigins?: Iterable<string>
}) {
  return requestOAuthToken(
    input.baseUrl ?? "https://api.sciener.com",
    new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      username: input.username,
      password: createHash("md5").update(input.password).digest("hex"),
    }),
    input.fetchImpl ?? fetch,
    input.allowedOrigins,
  )
}

export function refreshTtlockOAuthToken(input: {
  baseUrl?: string
  clientId: string
  clientSecret: string
  refreshToken: string
  fetchImpl?: FetchLike
  allowedOrigins?: Iterable<string>
}) {
  return requestOAuthToken(
    input.baseUrl ?? "https://api.sciener.com",
    new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    input.fetchImpl ?? fetch,
    input.allowedOrigins,
  )
}

interface TtlockClientOptions {
  baseUrl?: string
  token: () => Promise<TtlockToken>
  refreshToken?: () => Promise<TtlockToken>
  fetchImpl?: FetchLike
  now?: () => number
  allowedOrigins?: Iterable<string>
}

interface TtlockListResponse<T> {
  list?: T[]
  errcode?: number
  errmsg?: string
}

function validateBaseUrl(baseUrl: string, extraOrigins: Iterable<string> = []) {
  const url = new URL(baseUrl)
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins])
  if (url.protocol !== "https:" || !allowed.has(url.origin) || url.pathname !== "/") {
    throw new Error("TTLock API base URL is not allowlisted.")
  }
  return url.origin
}

function normalizeProviderCredential(
  row: Record<string, unknown>,
): AccessProviderCredential {
  return {
    externalCredentialId: String(row.keyboardPwdId),
    externalLockId: String(row.lockId),
    passcodeName: String(row.keyboardPwdName ?? ""),
    validFrom: new Date(Number(row.startDate)),
    validUntil: new Date(Number(row.endDate)),
    status:
      Number(row.status) === 1
        ? "active"
        : Number(row.status) === 2
          ? "expired"
          : Number(row.status) === 3 || Number(row.status) === 4
            ? "pending"
            : Number(row.status) === 5
              ? "failed"
              : "unknown",
  }
}

export class TtlockAccessProvider implements AccessProvider {
  readonly #baseUrl: string
  readonly #token: TtlockClientOptions["token"]
  readonly #refreshToken?: TtlockClientOptions["refreshToken"]
  readonly #fetch: FetchLike
  readonly #now: () => number

  constructor(options: TtlockClientOptions) {
    this.#baseUrl = validateBaseUrl(
      options.baseUrl ?? "https://api.sciener.com",
      options.allowedOrigins,
    )
    this.#token = options.token
    this.#refreshToken = options.refreshToken
    this.#fetch = options.fetchImpl ?? fetch
    this.#now = options.now ?? Date.now
  }

  async #request<T>(path: string, fields: Record<string, string | number>, refreshed = false) {
    const token = await this.#token()
    const body = new URLSearchParams({
      clientId: token.clientId,
      accessToken: token.accessToken,
      date: String(this.#now()),
    })
    for (const [key, value] of Object.entries(fields)) body.set(key, String(value))

    let response: Response
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      throw new AccessProviderError("retryable", "TTLock request failed.", {
        cause: error,
      })
    }

    if (response.status === 429) {
      throw new AccessProviderError("rate_limited", "TTLock rate limit reached.", {
        retryAfterSeconds: Number(response.headers.get("retry-after")) || null,
      })
    }
    if (!response.ok) {
      throw new AccessProviderError(
        response.status >= 500 ? "retryable" : "unknown",
        `TTLock request returned HTTP ${response.status}.`,
      )
    }

    const result = (await response.json()) as T & { errcode?: number; errmsg?: string }
    if (result.errcode && result.errcode !== 0) {
      const message = result.errmsg?.toLowerCase() ?? ""
      if (!refreshed && this.#refreshToken && /token|auth|login/.test(message)) {
        await this.#refreshToken()
        return this.#request<T>(path, fields, true)
      }
      if (/offline|gateway/.test(message)) {
        throw new AccessProviderError("offline", "TTLock gateway is unavailable.")
      }
      if (/exist|same|duplicate/.test(message)) {
        throw new AccessProviderError("collision", "TTLock passcode conflicts.")
      }
      throw new AccessProviderError(
        /token|auth|login/.test(message)
          ? "authentication_refreshable"
          : "unknown",
        `TTLock rejected the operation (${result.errcode}).`,
      )
    }
    return result
  }

  async provision(target: AccessProviderTarget) {
    const existing = await this.query(target.externalLockId, target.passcodeName)
    if (existing) return existing

    const result = await this.#request<{ keyboardPwdId: number }>(
      "/v3/keyboardPwd/add",
      {
        lockId: target.externalLockId,
        keyboardPwd: target.passcode,
        keyboardPwdName: target.passcodeName,
        startDate: target.validFrom.getTime(),
        endDate: target.validUntil.getTime(),
        addType: 2,
      },
    )
    return {
      externalCredentialId: String(result.keyboardPwdId),
      externalLockId: target.externalLockId,
      passcodeName: target.passcodeName,
      validFrom: target.validFrom,
      validUntil: target.validUntil,
      status: "active" as const,
    }
  }

  async modify(
    credential: AccessProviderCredential,
    input: Pick<AccessProviderTarget, "passcode" | "validFrom" | "validUntil">,
  ) {
    await this.#request("/v3/keyboardPwd/change", {
      lockId: credential.externalLockId,
      keyboardPwdId: credential.externalCredentialId,
      newKeyboardPwd: input.passcode,
      startDate: input.validFrom.getTime(),
      endDate: input.validUntil.getTime(),
      changeType: 2,
    })
    return { ...credential, validFrom: input.validFrom, validUntil: input.validUntil }
  }

  async revoke(credential: AccessProviderCredential) {
    await this.#request("/v3/keyboardPwd/delete", {
      lockId: credential.externalLockId,
      keyboardPwdId: credential.externalCredentialId,
      deleteType: 2,
    })
  }

  async query(externalLockId: string, passcodeName: string) {
    const result = await this.#request<TtlockListResponse<Record<string, unknown>>>(
      "/v3/lock/listKeyboardPwd",
      { lockId: externalLockId, pageNo: 1, pageSize: 100 },
    )
    const row = result.list?.find(
      (item) => String(item.keyboardPwdName ?? "") === passcodeName,
    )
    return row ? normalizeProviderCredential(row) : null
  }

  async reconcile(credential: AccessProviderCredential) {
    return this.query(credential.externalLockId, credential.passcodeName)
  }

  async inventory(): Promise<AccessProviderInventory> {
    const [gatewayResult, lockResult] = await Promise.all([
      this.#request<TtlockListResponse<Record<string, unknown>>>(
        "/v3/gateway/list",
        { pageNo: 1, pageSize: 100 },
      ),
      this.#request<TtlockListResponse<Record<string, unknown>>>("/v3/lock/list", {
        pageNo: 1,
        pageSize: 10_000,
      }),
    ])

    const gateways = (gatewayResult.list ?? []).map((row) => ({
      externalGatewayId: String(row.gatewayId),
      macAddress: row.gatewayMac ? String(row.gatewayMac) : null,
      online: Number(row.isOnline) === 1,
      lockCount: Number(row.lockNum) || 0,
    }))
    const locks = await Promise.all(
      (lockResult.list ?? []).map(async (row) => {
        const externalLockId = String(row.lockId)
        const gatewayLinks = await this.#request<
          TtlockListResponse<Record<string, unknown>>
        >("/v3/gateway/listByLock", { lockId: externalLockId })
        return {
          externalLockId,
          externalGatewayIds: (gatewayLinks.list ?? []).map((item) =>
            String(item.gatewayId),
          ),
          name: String(row.lockName ?? externalLockId),
          alias: row.lockAlias ? String(row.lockAlias) : null,
          macAddress: row.lockMac ? String(row.lockMac) : null,
          batteryLevel: Number.isFinite(Number(row.electricQuantity))
            ? Number(row.electricQuantity)
            : null,
          passcodeVersion: Number.isFinite(Number(row.keyboardPwdVersion))
            ? Number(row.keyboardPwdVersion)
            : null,
          hasGateway: Number(row.hasGateway) === 1,
        }
      }),
    )
    return { gateways, locks }
  }

  async health() {
    try {
      await this.inventory()
      return { ok: true, checkedAt: new Date() }
    } catch (error) {
      return {
        ok: false,
        checkedAt: new Date(),
        message: error instanceof Error ? error.message : "TTLock health check failed.",
      }
    }
  }

  async remoteUnlock(externalLockId: string) {
    await this.#request("/v3/lock/unlock", { lockId: externalLockId })
  }
}
