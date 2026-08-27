import { randomUUID } from "node:crypto"

import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { NvrPasswordStore } from "../auth/nvr-secret-store"
import type { EdgeRepositories } from "../local-storage/repositories"
import {
  mintLocalConnectionKey,
  type LocalNvrPublicView,
  type LocalNvrRow,
  type LocalNvrTestSummary,
  type LocalNvrVendor,
} from "../local-storage/local-nvr-types"
import { buildVigiLiveRtspUrl } from "../video-adapters/vigi-urls"
import {
  DefaultNvrProbeRunner,
  tcpDiscoverHost,
  type NvrProbeRunner,
  type NvrProbeSuiteResult,
} from "./nvr-probe"

export class LocalNvrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "LocalNvrError"
  }
}

function toPublicView(
  row: LocalNvrRow,
  hasPassword: boolean,
): LocalNvrPublicView {
  return {
    id: row.id,
    label: row.label,
    vendor: row.vendor,
    host: row.host,
    rtspPort: row.rtspPort,
    playbackPort: row.playbackPort,
    username: row.username,
    localConnectionKey: row.localConnectionKey,
    enabled: row.enabled,
    testChannelKey: row.testChannelKey,
    timeMode: row.timeMode,
    hasPassword,
    lastTest: row.lastTest,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseVendor(value: unknown): LocalNvrVendor {
  if (value === "vigi") {
    return "vigi"
  }

  throw new LocalNvrError("invalid_vendor", "Only VIGI NVRs are supported in v1.")
}

function parsePort(value: unknown, field: string): number {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new LocalNvrError("invalid_port", `${field} must be between 1 and 65535.`)
  }

  return port
}

function parseHost(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LocalNvrError("invalid_host", "NVR host is required.")
  }

  const host = value.trim()
  if (host.includes("@")) {
    throw new LocalNvrError("invalid_host", "NVR host cannot include credentials.")
  }

  return host
}

export class LocalNvrManager {
  private readonly probeRunner: NvrProbeRunner

  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly passwordStore: NvrPasswordStore,
    probeRunner?: NvrProbeRunner,
  ) {
    this.probeRunner = probeRunner ?? new DefaultNvrProbeRunner()
  }

  async listPublicNvrs(): Promise<LocalNvrPublicView[]> {
    const rows = this.repositories.listLocalNvrs()
    const views: LocalNvrPublicView[] = []

    for (const row of rows) {
      views.push(
        toPublicView(
          row,
          await this.passwordStore.has(row.localConnectionKey),
        ),
      )
    }

    return views
  }

  async getPublicNvr(id: string): Promise<LocalNvrPublicView | null> {
    const row = this.repositories.getLocalNvrById(id)
    if (!row) {
      return null
    }

    return toPublicView(
      row,
      await this.passwordStore.has(row.localConnectionKey),
    )
  }

  async createNvr(input: {
    label: string
    vendor: unknown
    host: unknown
    rtspPort: unknown
    playbackPort?: unknown
    username: unknown
    password: unknown
    enabled?: boolean
    testChannelKey?: unknown
  }): Promise<LocalNvrPublicView> {
    const label =
      typeof input.label === "string" && input.label.trim().length > 0
        ? input.label.trim()
        : null

    if (!label) {
      throw new LocalNvrError("invalid_label", "NVR label is required.")
    }

    const username =
      typeof input.username === "string" && input.username.trim().length > 0
        ? input.username.trim()
        : null

    if (!username) {
      throw new LocalNvrError("invalid_username", "NVR username is required.")
    }

    if (typeof input.password !== "string" || input.password.length === 0) {
      throw new LocalNvrError("invalid_password", "NVR password is required.")
    }

    const id = randomUUID()
    const localConnectionKey = mintLocalConnectionKey(id)
    const playbackPort =
      input.playbackPort === undefined || input.playbackPort === null
        ? null
        : parsePort(input.playbackPort, "playbackPort")

    const row = this.repositories.insertLocalNvr({
      id,
      label,
      vendor: parseVendor(input.vendor),
      host: parseHost(input.host),
      rtspPort: parsePort(input.rtspPort, "rtspPort"),
      playbackPort,
      username,
      localConnectionKey,
      enabled: input.enabled ?? true,
      testChannelKey:
        typeof input.testChannelKey === "string" &&
        input.testChannelKey.trim().length > 0
          ? input.testChannelKey.trim()
          : "1",
      timeMode: "unknown",
    })

    await this.passwordStore.set(localConnectionKey, input.password)
    this.repositories.invalidateCommissioning()
    return toPublicView(row, true)
  }

  async updateNvr(
    id: string,
    input: {
      label?: unknown
      host?: unknown
      rtspPort?: unknown
      playbackPort?: unknown | null
      username?: unknown
      password?: unknown
      enabled?: boolean
      testChannelKey?: unknown
    },
  ): Promise<LocalNvrPublicView | null> {
    const existing = this.repositories.getLocalNvrById(id)
    if (!existing) {
      return null
    }

    const patch: {
      label?: string
      host?: string
      rtspPort?: number
      playbackPort?: number | null
      username?: string
      enabled?: boolean
      testChannelKey?: string
      lastTest?: null
    } = {}

    if (input.label !== undefined) {
      if (typeof input.label !== "string" || input.label.trim().length === 0) {
        throw new LocalNvrError("invalid_label", "NVR label cannot be empty.")
      }
      patch.label = input.label.trim()
    }

    if (input.host !== undefined) {
      patch.host = parseHost(input.host)
    }

    if (input.rtspPort !== undefined) {
      patch.rtspPort = parsePort(input.rtspPort, "rtspPort")
    }

    if (input.playbackPort !== undefined) {
      patch.playbackPort =
        input.playbackPort === null
          ? null
          : parsePort(input.playbackPort, "playbackPort")
    }

    if (input.username !== undefined) {
      if (
        typeof input.username !== "string" ||
        input.username.trim().length === 0
      ) {
        throw new LocalNvrError("invalid_username", "NVR username cannot be empty.")
      }
      patch.username = input.username.trim()
    }

    if (input.enabled !== undefined) {
      patch.enabled = input.enabled
    }

    if (input.testChannelKey !== undefined) {
      if (
        typeof input.testChannelKey !== "string" ||
        input.testChannelKey.trim().length === 0
      ) {
        throw new LocalNvrError(
          "invalid_channel",
          "Test channel key cannot be empty.",
        )
      }
      patch.testChannelKey = input.testChannelKey.trim()
    }

    const newPassword =
      typeof input.password === "string" && input.password.length > 0
        ? input.password
        : null
    if (newPassword) {
      await this.passwordStore.set(existing.localConnectionKey, newPassword)
    }

    const configurationChanged = Object.keys(patch).length > 0 || newPassword !== null
    if (configurationChanged) {
      patch.lastTest = null
    }

    const updated = this.repositories.updateLocalNvr(id, patch)
    if (!updated) {
      return null
    }

    if (configurationChanged) {
      for (const camera of this.repositories.listLocalCamerasByNvrId(id)) {
        this.repositories.updateLocalCamera(camera.id, { lastTest: null })
      }
      this.repositories.invalidateCommissioning()
    }

    return toPublicView(
      updated,
      await this.passwordStore.has(updated.localConnectionKey),
    )
  }

  async deleteNvr(id: string): Promise<boolean> {
    const existing = this.repositories.getLocalNvrById(id)
    if (!existing) {
      return false
    }

    await this.passwordStore.delete(existing.localConnectionKey)
    const deleted = this.repositories.deleteLocalNvr(id)
    if (deleted) {
      this.repositories.invalidateCommissioning()
    }
    return deleted
  }

  async discover(input: {
    host: unknown
    rtspPort: unknown
  }): Promise<{ reachable: boolean; message: string }> {
    return tcpDiscoverHost(
      parseHost(input.host),
      parsePort(input.rtspPort, "rtspPort"),
    )
  }

  async testNvr(id: string): Promise<{
    nvr: LocalNvrPublicView
    result: NvrProbeSuiteResult
  } | null> {
    const row = this.repositories.getLocalNvrById(id)
    if (!row) {
      return null
    }

    const password = await this.passwordStore.get(row.localConnectionKey)
    if (!password) {
      const summary: LocalNvrTestSummary = {
        passed: false,
        testedAt: new Date().toISOString(),
        timeMode: row.timeMode,
        checks: [
          {
            check: "authentication",
            passed: false,
            code: "missing_password",
            message: "No protected password is stored for this NVR.",
          },
        ],
      }

      const updated = this.repositories.updateLocalNvr(id, {
        lastTest: summary,
      })

      return {
        nvr: toPublicView(updated!, false),
        result: {
          passed: false,
          timeMode: row.timeMode,
          checks: summary.checks,
        },
      }
    }

    const liveRtspUrl = buildVigiLiveRtspUrl({
      host: row.host,
      rtspPort: row.rtspPort,
      username: row.username,
      password,
      channelKey: row.testChannelKey,
      streamProfile: "main",
    })

    const result = await this.probeRunner.run({
      nvr: row,
      password,
      liveRtspUrl,
    })

    const summary: LocalNvrTestSummary = {
      passed: result.passed,
      testedAt: new Date().toISOString(),
      timeMode: result.timeMode,
      checks: result.checks,
    }

    const updated = this.repositories.updateLocalNvr(id, {
      lastTest: summary,
      timeMode: result.timeMode,
    })

    return {
      nvr: toPublicView(
        updated!,
        await this.passwordStore.has(updated!.localConnectionKey),
      ),
      result,
    }
  }

  async resolveSourceRtspUrl(
    edgeConfigV2: EdgeConfigV2,
    sourceId: string,
  ): Promise<string | null> {
    const source = edgeConfigV2.sources.find((entry) => entry.id === sourceId)
    if (!source) {
      return null
    }

    const recorder = edgeConfigV2.recorders.find(
      (entry) => entry.id === source.recorderId,
    )
    if (!recorder?.enabled) {
      return null
    }

    const localNvr = this.repositories.getLocalNvrByConnectionKey(
      recorder.localConnectionKey,
    )
    if (!localNvr?.enabled) {
      return null
    }

    const password = await this.passwordStore.get(localNvr.localConnectionKey)
    if (!password) {
      return null
    }

    return buildVigiLiveRtspUrl({
      host: localNvr.host,
      rtspPort: localNvr.rtspPort,
      username: localNvr.username,
      password,
      channelKey: source.channelKey,
      streamProfile: source.streamProfile,
    })
  }

  async buildRuntimeSourceRtspMap(
    edgeConfigV2: EdgeConfigV2,
  ): Promise<Record<string, string>> {
    const map: Record<string, string> = {}

    for (const source of edgeConfigV2.sources) {
      if (!source.enabled) {
        continue
      }

      const url = await this.resolveSourceRtspUrl(edgeConfigV2, source.id)
      if (url) {
        map[source.id] = url
      }
    }

    return map
  }
}
