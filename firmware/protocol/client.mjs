import { randomUUID } from "node:crypto"

/**
 * @typedef {Object} DeviceClientOptions
 * @property {string} baseUrl
 * @property {string} [deviceId]
 * @property {string} [secret]
 * @property {string} [correlationId]
 * @property {boolean} [offline]
 */

export class DeviceProtocolError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   * @param {unknown} [body]
   */
  constructor(code, message, status = 400, body = null) {
    super(message)
    this.name = "DeviceProtocolError"
    this.code = code
    this.status = status
    this.body = body
  }
}

/**
 * @param {string} baseUrl
 * @param {string} path
 */
function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`
}

/**
 * @param {Response} response
 */
async function parseResponse(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export class DeviceV1Client {
  /** @param {DeviceClientOptions} options */
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.deviceId = options.deviceId ?? null
    this.secret = options.secret ?? null
    this.correlationId = options.correlationId ?? randomUUID()
    this.offline = options.offline ?? false
  }

  /** @param {{ deviceId: string, secret: string }} credentials */
  setCredentials(credentials) {
    this.deviceId = credentials.deviceId
    this.secret = credentials.secret
  }

  /** @param {boolean} offline */
  setOffline(offline) {
    this.offline = offline
  }

  authHeaders() {
    if (!this.deviceId || !this.secret) {
      throw new DeviceProtocolError(
        "DEVICE_UNAUTHENTICATED",
        "Device credentials are not configured.",
        401,
      )
    }

    return {
      Authorization: `Device ${this.deviceId} ${this.secret}`,
      "x-correlation-id": this.correlationId,
      "content-type": "application/json",
    }
  }

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, auth?: boolean }} [options]
   */
  async request(path, options = {}) {
    if (this.offline) {
      throw new DeviceProtocolError(
        "NETWORK_ERROR",
        "Device is offline.",
        0,
      )
    }

    const headers = {
      "content-type": "application/json",
      "x-correlation-id": this.correlationId,
      ...(options.auth === false ? {} : this.authHeaders()),
    }

    let response

    try {
      response = await fetch(joinUrl(this.baseUrl, path), {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      throw new DeviceProtocolError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed.",
        0,
      )
    }

    const body = await parseResponse(response)

    if (!response.ok) {
      throw new DeviceProtocolError(
        body?.code ?? "DEVICE_ERROR",
        body?.message ?? `Request failed with status ${response.status}.`,
        response.status,
        body,
      )
    }

    return body
  }

  /**
   * @param {{ enrollmentCode: string, hardwareUid: string, firmwareVersion?: string }} input
   */
  async provision(input) {
    const body = await this.request("/api/device/v1/provision", {
      method: "POST",
      auth: false,
      body: {
        enrollmentCode: input.enrollmentCode,
        hardwareUid: input.hardwareUid,
        firmwareVersion: input.firmwareVersion,
      },
    })

    this.deviceId = body.data.deviceId
    this.secret = body.data.secret

    return {
      deviceId: body.data.deviceId,
      secret: body.data.secret,
      credentialVersion: body.data.credentialVersion,
    }
  }

  /**
   * @param {{ bootId: string, firmwareVersion?: string, uptimeMs?: number, appliedConfigVersion?: number }} input
   */
  async heartbeat(input) {
    return this.request("/api/device/v1/heartbeat", {
      method: "POST",
      body: input,
    })
  }

  async getConfig() {
    return this.request("/api/device/v1/config")
  }

  async listCommands() {
    return this.request("/api/device/v1/commands")
  }

  /**
   * @param {string} commandId
   * @param {{ idempotencyKey: string, success: boolean, result?: Record<string, unknown> }} input
   */
  async acknowledgeCommand(commandId, input) {
    return this.request(`/api/device/v1/commands/${commandId}/ack`, {
      method: "POST",
      body: input,
    })
  }

  /**
   * @param {{ bootId: string, sequence: number, kind: "point" | "correction", side: "a" | "b", delta?: number }} input
   */
  async postScoreEvent(input) {
    return this.request("/api/device/v1/events", {
      method: "POST",
      body: input,
    })
  }
}
