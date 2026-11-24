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

/** Channels scanned when the caller doesn't say (VIGI NVRs come with 4, 8 or 16). */
const MAX_SCAN_CHANNELS = 16
/** Channels checked together; NVRs limit simultaneous RTSP sessions. */
const SCAN_CONCURRENCY = 2
/** The scan stops after a whole block of empty channels (beyond the first block). */
const SCAN_BLOCK_SIZE = 4
/** Failures that are usually momentary and worth one more try. */
const RETRYABLE_PROBE_CODES = new Set([
  "source_busy",
  "probe_timed_out",
  "ffmpeg_failed",
  "video_stream_missing",
])

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
    failures: Array<{
      channelKey: string
      code: string
      summary: string
      action: string
    }>
    skipped: number
    probed: number
    notes: Array<{ channelKey: string; message: string }>
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

    const maxChannels = options?.maxChannels ?? MAX_SCAN_CHANNELS
    const created: LocalCameraPublicView[] = []
    const updated: LocalCameraPublicView[] = []
    const unavailable: LocalCameraPublicView[] = []
    const failures: Array<{
      channelKey: string
      code: string
      summary: string
      action: string
    }> = []
    let skipped = 0
    let probed = 0
    /** Things the installer should know that aren't failures (e.g. H.265 handled via sub-stream). */
    const notes: Array<{ channelKey: string; message: string }> = []

    // Returns whether the channel had live video, so the scan can stop early on empty ranges.
    const scanChannel = async (channel: number): Promise<"live" | "empty" | "failed"> => {
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

      const probe = await this.probeWithRetry(liveRtspUrl)
      probed += 1
      if (!probe.live) {
        if (probe.code === "source_auth_failed") {
          throw new LocalCameraError(
            "source_auth_failed",
            "The NVR rejected the saved username or password. Return to Add NVR, change the credentials, and scan again.",
          )
        }
        // No camera on this channel: not a problem, so don't report it as a failure.
        if (probe.diagnostic?.code === "channel_not_found" && !existing) {
          skipped += 1
          return "empty"
        }
        failures.push({
          channelKey,
          code: probe.code ?? "source_unavailable",
          summary:
            probe.diagnostic?.summary ??
            "This channel did not return a usable video stream.",
          action:
            probe.diagnostic?.action ??
            "Confirm the channel is enabled on the NVR and try again.",
        })
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
                  probe.code === "probe_timed_out"
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
        return "failed"
      }

      // Replays need H.264. If the main stream is H.265, try the camera's
      // sub-stream, which on most NVRs is H.264, before giving up on the channel.
      let chosenProfile: LocalCameraStreamProfile = streamProfile
      let chosenCodec = probe.codec
      if (probe.codec !== "h264") {
        const subProbe = await this.probeWithRetry(
          buildVigiLiveRtspUrl({
            host: nvr.host,
            rtspPort: nvr.rtspPort,
            username: nvr.username,
            password,
            channelKey,
            streamProfile: "sub",
          }),
        )
        if (subProbe.live && subProbe.codec === "h264") {
          chosenProfile = "sub"
          chosenCodec = "h264"
          notes.push({
            channelKey,
            message: `Channel ${channelKey}: the main stream is ${probe.codec.toUpperCase()}, so PlayTT will use the H.264 sub-stream (lower resolution). For full quality, set this camera's main stream to H.264 in the NVR and scan again.`,
          })
        } else {
          notes.push({
            channelKey,
            message: `Channel ${channelKey} sends ${probe.codec.toUpperCase()} video, which replays can't use yet. Set this camera's main stream to H.264 in the NVR and scan again.`,
          })
        }
      }
      const target =
        chosenProfile === streamProfile
          ? existing
          : this.repositories.findLocalCameraByNvrChannel(nvrId, channelKey, chosenProfile)

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

      const row = target
        ? this.repositories.updateLocalCamera(target.id, {
            codec: chosenCodec,
            lastTest,
          })!
        : this.repositories.insertLocalCamera({
            id: randomUUID(),
            nvrId,
            label: defaultCameraLabel(nvr.label, channelKey, chosenProfile),
            channelKey,
            streamProfile: chosenProfile,
            codec: chosenCodec,
            enabled: false,
          })

      if (!target) {
        this.repositories.updateLocalCamera(row.id, { lastTest })
      }

      const view = {
        id: row.id,
        nvrId: row.nvrId,
        nvrLabel: nvr.label,
        label: row.label,
        channelKey: row.channelKey,
        streamProfile: row.streamProfile,
        codec: chosenCodec,
        enabled: row.enabled,
        lastTest,
        healthStatus: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
      if (target) {
        updated.push(view)
      } else {
        created.push(view)
      }
      return "live"
    }

    // Scan in blocks: a few channels in parallel (NVRs cap simultaneous RTSP
    // sessions), and stop once a whole block beyond the first is empty.
    for (let start = 1; start <= maxChannels; start += SCAN_BLOCK_SIZE) {
      const block: number[] = []
      for (let channel = start; channel < start + SCAN_BLOCK_SIZE && channel <= maxChannels; channel += 1) {
        block.push(channel)
      }
      const outcomes: Array<"live" | "empty" | "failed"> = []
      for (let index = 0; index < block.length; index += SCAN_CONCURRENCY) {
        const batch = block.slice(index, index + SCAN_CONCURRENCY)
        outcomes.push(...(await Promise.all(batch.map((channel) => scanChannel(channel)))))
      }
      if (start > SCAN_BLOCK_SIZE && outcomes.every((outcome) => outcome === "empty")) {
        break
      }
    }

    const byChannel = (a: LocalCameraPublicView, b: LocalCameraPublicView) =>
      Number(a.channelKey) - Number(b.channelKey)
    created.sort(byChannel)
    updated.sort(byChannel)
    unavailable.sort(byChannel)
    failures.sort((a, b) => Number(a.channelKey) - Number(b.channelKey))
    notes.sort((a, b) => Number(a.channelKey) - Number(b.channelKey))

    return {
      created,
      updated,
      unavailable,
      failures,
      notes,
      skipped,
      probed,
    }
  }

  /**
   * One automatic retry for problems that are usually momentary: the NVR's
   * stream limit, a slow first frame, or a dropped connection.
   */
  private async probeWithRetry(liveRtspUrl: string) {
    const first = await this.channelProbeRunner.probe({ liveRtspUrl })
    const code = first.diagnostic?.code
    if (first.live || !code || !RETRYABLE_PROBE_CODES.has(code)) return first
    await new Promise((resolve) => setTimeout(resolve, code === "source_busy" ? 3000 : 1500))
    return this.channelProbeRunner.probe({ liveRtspUrl })
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
