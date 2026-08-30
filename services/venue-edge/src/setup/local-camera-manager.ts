import { randomUUID } from "node:crypto"

import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { NvrPasswordStore } from "../auth/nvr-secret-store"
import type { EdgeRepositories } from "../local-storage/repositories"
import type {
  LocalCameraCodec,
  LocalCameraPublicView,
  LocalCameraStreamProfile,
  LocalCameraTestSummary,
} from "../local-storage/local-camera-types"
import type { SourceHealthStatus } from "../health/types"
import { buildVigiLiveRtspUrl } from "../video-adapters/vigi-urls"
import type { LocalNvrManager } from "./local-nvr-manager"
import {
  DefaultCameraChannelProbeRunner,
  type CameraChannelProbeRunner,
} from "./camera-channel-probe"

export class LocalCameraError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "LocalCameraError"
  }
}

function parseStreamProfile(value: unknown): LocalCameraStreamProfile {
  if (value === "main" || value === "sub") {
    return value
  }

  throw new LocalCameraError(
    "invalid_stream_profile",
    "Stream profile must be main or sub.",
  )
}

function parseCodec(value: unknown): LocalCameraCodec {
  if (value === "h264" || value === "h265" || value === "unknown") {
    return value
  }

  throw new LocalCameraError("invalid_codec", "Codec must be h264, h265, or unknown.")
}

function defaultCameraLabel(
  nvrLabel: string,
  channelKey: string,
  streamProfile: LocalCameraStreamProfile,
): string {
  return `${nvrLabel} ch${channelKey} (${streamProfile})`
}

export class LocalCameraManager {
  private readonly channelProbeRunner: CameraChannelProbeRunner

  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly passwordStore: NvrPasswordStore,
    private readonly localNvrManager: LocalNvrManager,
    channelProbeRunner?: CameraChannelProbeRunner,
  ) {
    this.channelProbeRunner =
      channelProbeRunner ?? new DefaultCameraChannelProbeRunner()
  }

  async listPublicCameras(): Promise<LocalCameraPublicView[]> {
    const cameras = this.repositories.listLocalCameras()
    const views: LocalCameraPublicView[] = []

    for (const camera of cameras) {
      const nvr = this.repositories.getLocalNvrById(camera.nvrId)
      const health = this.repositories.getSourceHealthBySourceId(camera.id)

      views.push({
        id: camera.id,
        nvrId: camera.nvrId,
        nvrLabel: nvr?.label ?? "Unknown NVR",
        label: camera.label,
        channelKey: camera.channelKey,
        streamProfile: camera.streamProfile,
        codec: camera.codec,
        enabled: camera.enabled,
        lastTest: camera.lastTest,
        healthStatus: health?.status ?? null,
        createdAt: camera.createdAt,
        updatedAt: camera.updatedAt,
      })
    }

    return views
  }

  async createCamera(input: {
    nvrId: unknown
    label?: unknown
    channelKey: unknown
    streamProfile?: unknown
    codec?: unknown
    enabled?: boolean
  }): Promise<LocalCameraPublicView> {
    const nvrId =
      typeof input.nvrId === "string" && input.nvrId.trim().length > 0
        ? input.nvrId.trim()
        : null

    if (!nvrId) {
      throw new LocalCameraError("invalid_nvr", "NVR id is required.")
    }

    const nvr = this.repositories.getLocalNvrById(nvrId)
    if (!nvr) {
      throw new LocalCameraError("nvr_not_found", "NVR not found.")
    }

    const channelKey =
      typeof input.channelKey === "string" && input.channelKey.trim().length > 0
        ? input.channelKey.trim()
        : null

    if (!channelKey) {
      throw new LocalCameraError("invalid_channel", "Channel key is required.")
    }

    const streamProfile = parseStreamProfile(input.streamProfile ?? "main")
    const existing = this.repositories.findLocalCameraByNvrChannel(
      nvrId,
      channelKey,
      streamProfile,
    )
    if (existing) {
      throw new LocalCameraError(
        "duplicate_camera",
        "A camera with this NVR, channel, and stream already exists.",
      )
    }

    const label =
      typeof input.label === "string" && input.label.trim().length > 0
        ? input.label.trim()
        : defaultCameraLabel(nvr.label, channelKey, streamProfile)

    const row = this.repositories.insertLocalCamera({
      id: randomUUID(),
      nvrId,
      label,
      channelKey,
      streamProfile,
      codec: input.codec ? parseCodec(input.codec) : "unknown",
      enabled: input.enabled ?? false,
    })
    this.repositories.invalidateCommissioning()

    return {
      id: row.id,
      nvrId: row.nvrId,
      nvrLabel: nvr.label,
      label: row.label,
      channelKey: row.channelKey,
      streamProfile: row.streamProfile,
      codec: row.codec,
      enabled: row.enabled,
      lastTest: row.lastTest,
      healthStatus: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async updateCamera(
    id: string,
    input: {
      label?: unknown
      streamProfile?: unknown
      codec?: unknown
      enabled?: boolean
    },
  ): Promise<LocalCameraPublicView | null> {
    const existing = this.repositories.getLocalCameraById(id)
    if (!existing) {
      return null
    }

    const patch: {
      label?: string
      streamProfile?: LocalCameraStreamProfile
      codec?: LocalCameraCodec
      enabled?: boolean
      lastTest?: null
    } = {}

    if (input.label !== undefined) {
      if (typeof input.label !== "string" || input.label.trim().length === 0) {
        throw new LocalCameraError("invalid_label", "Camera label is required.")
      }
      patch.label = input.label.trim()
    }

    if (input.streamProfile !== undefined) {
      patch.streamProfile = parseStreamProfile(input.streamProfile)
    }

    if (input.codec !== undefined) {
      patch.codec = parseCodec(input.codec)
    }

    if (input.enabled !== undefined) {
      patch.enabled = Boolean(input.enabled)
    }

    const configurationChanged = Object.keys(patch).length > 0
    if (configurationChanged) {
      patch.lastTest = null
    }

    const updated = this.repositories.updateLocalCamera(id, patch)
    if (!updated) {
      return null
    }

    if (configurationChanged) {
      this.repositories.invalidateCommissioning()
    }

    const nvr = this.repositories.getLocalNvrById(updated.nvrId)
    const health = this.repositories.getSourceHealthBySourceId(updated.id)

    return {
      id: updated.id,
      nvrId: updated.nvrId,
      nvrLabel: nvr?.label ?? "Unknown NVR",
      label: updated.label,
      channelKey: updated.channelKey,
      streamProfile: updated.streamProfile,
      codec: updated.codec,
      enabled: updated.enabled,
      lastTest: updated.lastTest,
      healthStatus: health?.status ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  async deleteCamera(id: string): Promise<boolean> {
    const deleted = this.repositories.deleteLocalCamera(id)
    if (deleted) {
      this.repositories.invalidateCommissioning()
    }
    return deleted
  }

  async enumerateCameras(
    nvrId: string,
    options?: { maxChannels?: number },
  ): Promise<{
    created: LocalCameraPublicView[]
    updated: LocalCameraPublicView[]
    unavailable: LocalCameraPublicView[]
    skipped: number
    probed: number
  }> {
    const nvr = this.repositories.getLocalNvrById(nvrId)
    if (!nvr) {
      throw new LocalCameraError("nvr_not_found", "NVR not found.")
    }

    const password = await this.passwordStore.get(nvr.localConnectionKey)
    if (!password) {
      throw new LocalCameraError(
        "missing_password",
        "NVR password is not stored locally.",
      )
    }

    const maxChannels = options?.maxChannels ?? 8
    const created: LocalCameraPublicView[] = []
    const updated: LocalCameraPublicView[] = []
    const unavailable: LocalCameraPublicView[] = []
    let skipped = 0

    for (let channel = 1; channel <= maxChannels; channel += 1) {
      const channelKey = String(channel)
      const streamProfile: LocalCameraStreamProfile = "main"

      const existing = this.repositories.findLocalCameraByNvrChannel(
        nvrId,
        channelKey,
        streamProfile,
      )
      const liveRtspUrl = buildVigiLiveRtspUrl({
        host: nvr.host,
        rtspPort: nvr.rtspPort,
        username: nvr.username,
        password,
        channelKey,
        streamProfile,
      })

      const probe = await this.channelProbeRunner.probe({ liveRtspUrl })
      if (!probe.live) {
        if (existing) {
          const lastTest: LocalCameraTestSummary = {
            passed: false,
            testedAt: new Date().toISOString(),
            checks: [
              {
                check: "live_rtsp",
                passed: false,
                code: probe.code ?? "source_unavailable",
                message:
                  probe.code === "source_auth_failed"
                    ? "Authentication failed while checking this channel."
                    : probe.code === "probe_timed_out"
                      ? "The channel did not respond before the probe timed out."
                      : "No valid video stream was found on this channel.",
              },
            ],
          }
          const row = this.repositories.updateLocalCamera(existing.id, {
            codec: "unknown",
            lastTest,
          })!
          unavailable.push({
            id: row.id,
            nvrId: row.nvrId,
            nvrLabel: nvr.label,
            label: row.label,
            channelKey: row.channelKey,
            streamProfile: row.streamProfile,
            codec: row.codec,
            enabled: row.enabled,
            lastTest,
            healthStatus: null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
        } else {
          skipped += 1
        }
        continue
      }

      const lastTest: LocalCameraTestSummary = {
        passed: true,
        testedAt: new Date().toISOString(),
        checks: [
          {
            check: "live_rtsp",
            passed: true,
            message: "Live RTSP stream responded during enumeration.",
          },
        ],
      }

      const row = existing
        ? this.repositories.updateLocalCamera(existing.id, {
            codec: probe.codec,
            lastTest,
          })!
        : this.repositories.insertLocalCamera({
            id: randomUUID(),
            nvrId,
            label: defaultCameraLabel(nvr.label, channelKey, streamProfile),
            channelKey,
            streamProfile,
            codec: probe.codec,
            enabled: false,
          })

      if (!existing) {
        this.repositories.updateLocalCamera(row.id, { lastTest })
      }

      const view = {
        id: row.id,
        nvrId: row.nvrId,
        nvrLabel: nvr.label,
        label: row.label,
        channelKey: row.channelKey,
        streamProfile: row.streamProfile,
        codec: probe.codec,
        enabled: row.enabled,
        lastTest,
        healthStatus: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
      if (existing) {
        updated.push(view)
      } else {
        created.push(view)
      }
    }

    return { created, updated, unavailable, skipped, probed: maxChannels }
  }

  async resolveCameraRtspUrl(cameraId: string): Promise<string | null> {
    const camera = this.repositories.getLocalCameraById(cameraId)
    if (!camera) {
      return null
    }

    const nvr = this.repositories.getLocalNvrById(camera.nvrId)
    if (!nvr?.enabled) {
      return null
    }

    const password = await this.passwordStore.get(nvr.localConnectionKey)
    if (!password) {
      return null
    }

    return buildVigiLiveRtspUrl({
      host: nvr.host,
      rtspPort: nvr.rtspPort,
      username: nvr.username,
      password,
      channelKey: camera.channelKey,
      streamProfile: camera.streamProfile,
    })
  }

  async buildRuntimeSourceRtspMap(
    edgeConfigV2: EdgeConfigV2 | null,
  ): Promise<Record<string, string>> {
    const map: Record<string, string> = {}

    if (edgeConfigV2) {
      for (const source of edgeConfigV2.sources) {
        if (!source.enabled) {
          continue
        }

        const recorder = edgeConfigV2.recorders.find(
          (entry) => entry.id === source.recorderId,
        )
        if (!recorder?.enabled) {
          continue
        }

        let url: string | null = null
        const localNvr = this.repositories.getLocalNvrByConnectionKey(
          recorder.localConnectionKey,
        )

        if (localNvr) {
          const streamProfile =
            source.streamProfile === "sub" ? "sub" : "main"
          const localCamera = this.repositories.findLocalCameraByNvrChannel(
            localNvr.id,
            source.channelKey,
            streamProfile,
          )
          if (localCamera) {
            url = await this.resolveCameraRtspUrl(localCamera.id)
          }
        }

        if (!url) {
          url = await this.localNvrManager.resolveSourceRtspUrl(
            edgeConfigV2,
            source.id,
          )
        }

        if (url) {
          map[source.id] = url
        }
      }
    }

    const routes = this.repositories.listAllLocalResourceRoutes()
    for (const route of routes) {
      if (!route.enabled || !route.captureModes.includes("edge_buffer")) {
        continue
      }

      const camera = this.repositories.getLocalCameraById(route.cameraId)
      if (!camera?.enabled) {
        continue
      }

      const url = await this.resolveCameraRtspUrl(camera.id)
      if (!url) {
        continue
      }

      map[camera.id] = url

      if (edgeConfigV2) {
        const nvr = this.repositories.getLocalNvrById(camera.nvrId)
        if (!nvr) {
          continue
        }

        const recorder = edgeConfigV2.recorders.find(
          (entry) => entry.localConnectionKey === nvr.localConnectionKey,
        )
        if (!recorder) {
          continue
        }

        const source = edgeConfigV2.sources.find(
          (entry) =>
            entry.recorderId === recorder.id &&
            entry.channelKey === camera.channelKey &&
            entry.streamProfile === camera.streamProfile,
        )
        if (source) {
          map[source.id] = url
        }
      }
    }

    return map
  }
}
