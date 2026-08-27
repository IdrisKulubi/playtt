import { randomUUID } from "node:crypto"

import { parseEdgeConfigV2, type EdgeConfigV2 } from "./config-v2"

export class EdgeProtocolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly body: unknown = null
  ) {
    super(message)
    this.name = "EdgeProtocolError"
  }
}

export interface UploadGrant {
  url: string
  expiresAt: string
  contentType?: string
}

export interface CaptureReplayPayload {
  replayRequestId: string
  replayId: string
  mediaAssetId: string
  objectKey: string
  captureAt: string
  preRollSeconds: number
  postRollSeconds: number
  sourceType: "edge_buffer" | "nvr_playback"
  resourceId: string
  configRevisionId: string
  playSessionId: string
  uploadGrant: UploadGrant
}

export interface EdgeCommand {
  id: string
  kind: string
  payload: CaptureReplayPayload
  expiresAt: string
  correlationId: string
  attemptCount: number
}

export type ReplayProgressStatus =
  | "edge_acknowledged"
  | "capturing"
  | "extracting"
  | "uploading"
  | "verifying"
  | "ready"
  | "edge_offline"
  | "buffer_missing"
  | "extraction_failed"
  | "upload_failed"
  | "expired"
  | "failed"

export interface EdgeConfig {
  configVersion: number
  resourceId: string
  role: string
  assignment: {
    id: string
    locationId: string
    effectiveFrom: string
    effectiveTo: string | null
  }
  config: Record<string, unknown>
}

export interface EdgeConfigV2Application {
  id: string
  installationId: string
  configRevisionId: string
  status: "applied" | "rejected"
  attemptedAt: string
  appliedAt: string | null
  idempotent: boolean
}

export interface EdgeClientOptions {
  baseUrl: string
  deviceId?: string
  secret?: string
  correlationId?: string
  agentVersion?: string
  fetchImpl?: typeof fetch
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`
}

async function parseResponse(response: Response): Promise<unknown> {
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

export class EdgeV1Client {
  private readonly fetchImpl: typeof fetch

  baseUrl: string
  deviceId: string | null
  secret: string | null
  correlationId: string
  agentVersion: string | null

  constructor(options: EdgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.deviceId = options.deviceId ?? null
    this.secret = options.secret ?? null
    this.correlationId = options.correlationId ?? randomUUID()
    this.agentVersion = options.agentVersion ?? null
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  setCredentials(credentials: { deviceId: string; secret: string }): void {
    this.deviceId = credentials.deviceId
    this.secret = credentials.secret
  }

  authHeaders(): Record<string, string> {
    if (!this.deviceId || !this.secret) {
      throw new EdgeProtocolError(
        "DEVICE_UNAUTHENTICATED",
        "Device credentials are not configured.",
        401
      )
    }

    return {
      Authorization: `Device ${this.deviceId} ${this.secret}`,
      "x-correlation-id": this.correlationId,
      ...(this.agentVersion
        ? { "x-playtt-edge-agent-version": this.agentVersion }
        : {}),
      "content-type": "application/json",
    }
  }

  async request(
    path: string,
    options: { method?: string; body?: unknown; auth?: boolean } = {}
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-correlation-id": this.correlationId,
      ...(options.auth === false ? {} : this.authHeaders()),
    }

    let response: Response

    try {
      response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      throw new EdgeProtocolError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed.",
        0
      )
    }

    const body = await parseResponse(response)

    if (!response.ok) {
      const errorBody = body as { code?: string; message?: string } | null
      throw new EdgeProtocolError(
        errorBody?.code ?? "DEVICE_ERROR",
        errorBody?.message ?? `Request failed with status ${response.status}.`,
        response.status,
        body
      )
    }

    return body
  }

  async getConfig(): Promise<EdgeConfig> {
    const body = (await this.request("/api/edge/v1/config")) as {
      data: EdgeConfig
    }
    return body.data
  }

  async getConfigV2(): Promise<EdgeConfigV2> {
    if (!this.agentVersion) {
      throw new EdgeProtocolError(
        "AGENT_VERSION_REQUIRED",
        "VenueEdge Agent version is required for Config v2.",
        426
      )
    }
    const body = (await this.request("/api/edge/v2/config")) as {
      data: unknown
    }
    return parseEdgeConfigV2(body.data)
  }

  async acknowledgeConfigV2Application(input: {
    installationId: string
    configRevisionId: string
    status: "applied" | "rejected"
    bootId?: string
    errorCode?: string
    errorDetails?: Record<string, unknown>
  }): Promise<EdgeConfigV2Application> {
    if (!this.agentVersion) {
      throw new EdgeProtocolError(
        "AGENT_VERSION_REQUIRED",
        "VenueEdge Agent version is required for Config v2.",
        426
      )
    }
    const body = (await this.request("/api/edge/v2/config/applications", {
      method: "POST",
      body: input,
    })) as { data: EdgeConfigV2Application }
    return body.data
  }

  async heartbeat(input: {
    bootId: string
    observedAt?: string
    firmwareVersion?: string
    uptimeMs?: number
    metrics?: Record<string, unknown>
    appliedConfigVersion?: number
  }): Promise<{
    health: string
    lastHeartbeatAt: string
    sampled: boolean
    pendingCommandCount: number
  }> {
    const body = (await this.request("/api/edge/v1/heartbeat", {
      method: "POST",
      body: input,
    })) as {
      data: {
        health: string
        lastHeartbeatAt: string
        sampled: boolean
        pendingCommandCount: number
      }
    }

    return body.data
  }

  async listCommands(): Promise<EdgeCommand[]> {
    const body = (await this.request("/api/edge/v1/commands")) as {
      data: { commands: EdgeCommand[] }
    }

    return body.data.commands
  }

  async acknowledgeCommand(
    commandId: string,
    input: {
      idempotencyKey: string
      success: boolean
      result?: Record<string, unknown>
    }
  ): Promise<unknown> {
    return this.request(`/api/edge/v1/commands/${commandId}/ack`, {
      method: "POST",
      body: input,
    })
  }

  async reportReplayProgress(
    replayRequestId: string,
    input: {
      status: ReplayProgressStatus
      failureReason?: string
      checksumSha256?: string
      sizeBytes?: number
    }
  ): Promise<unknown> {
    return this.request(
      `/api/edge/v1/replay-requests/${replayRequestId}/progress`,
      {
        method: "POST",
        body: input,
      }
    )
  }

  async renewUploadGrant(mediaAssetId: string): Promise<UploadGrant> {
    const body = (await this.request(
      `/api/edge/v1/media/${mediaAssetId}/upload-url`,
      { method: "POST", body: {} }
    )) as { data: { uploadGrant: UploadGrant } }

    return body.data.uploadGrant
  }

  async rotateCredential(): Promise<{
    secret: string
    credentialVersion: number
    previousVersion: number
  }> {
    const body = (await this.request("/api/device/v1/credentials/rotate", {
      method: "POST",
      body: {},
    })) as {
      data: {
        secret: string
        credentialVersion: number
        previousVersion: number
      }
    }

    return body.data
  }

  async acknowledgeCredentialRotation(): Promise<{
    credentialVersion: number
    previousVersion: number | null
  }> {
    const body = (await this.request(
      "/api/device/v1/credentials/acknowledge",
      {
        method: "POST",
        body: {},
      }
    )) as {
      data: {
        credentialVersion: number
        previousVersion: number | null
      }
    }

    return body.data
  }

  async rollbackCredentialRotation(): Promise<{
    credentialVersion: number
    rolledBackVersion: number
  }> {
    const body = (await this.request("/api/device/v1/credentials/rollback", {
      method: "POST",
      body: {},
    })) as {
      data: {
        credentialVersion: number
        rolledBackVersion: number
      }
    }

    return body.data
  }
}
