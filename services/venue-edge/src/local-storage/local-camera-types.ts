import type { ReplayCaptureMode, ReplaySelectionMode } from "../cloud/config-v2"
import type { SourceHealthStatus } from "../health/types"

export type LocalCameraStreamProfile = "main" | "sub"
export type LocalCameraCodec = "h264" | "h265" | "unknown"

export interface LocalCameraTestSummary {
  passed: boolean
  testedAt: string
  checks: Array<{
    check: string
    passed: boolean
    code?: string
    message: string
  }>
}

export interface LocalCameraRow {
  id: string
  nvrId: string
  label: string
  channelKey: string
  streamProfile: LocalCameraStreamProfile
  codec: LocalCameraCodec
  enabled: boolean
  lastTest: LocalCameraTestSummary | null
  createdAt: string
  updatedAt: string
}

export interface LocalCameraPublicView {
  id: string
  nvrId: string
  nvrLabel: string
  label: string
  channelKey: string
  streamProfile: LocalCameraStreamProfile
  codec: LocalCameraCodec
  enabled: boolean
  lastTest: LocalCameraTestSummary | null
  healthStatus: SourceHealthStatus | null
  createdAt: string
  updatedAt: string
}

export interface LocalResourcePolicyRow {
  resourceId: string
  label: string
  selectionMode: ReplaySelectionMode
  manualSourceId: string | null
  failureThreshold: number
  cooldownSeconds: number
  healthyThreshold: number
  autoFailback: boolean
  createdAt: string
  updatedAt: string
}

export interface LocalResourceRouteRow {
  id: string
  resourceId: string
  cameraId: string
  priority: number
  captureModes: ReplayCaptureMode[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type MappingWarningCode =
  | "duplicate_mapping"
  | "camera_disabled"
  | "camera_unhealthy"
  | "unknown_resource"
  | "missing_camera"

export interface MappingWarning {
  code: MappingWarningCode
  message: string
}

export interface LocalResourceCandidateView {
  cameraId: string
  priority: number
  captureModes: ReplayCaptureMode[]
  enabled: boolean
  cameraLabel: string | null
  nvrLabel: string | null
  channelKey: string | null
}

export interface LocalResourcePolicyView {
  resourceId: string
  label: string
  selectionMode: ReplaySelectionMode
  manualSourceId: string | null
  failover: {
    failureThreshold: number
    cooldownSeconds: number
    healthyThreshold: number
    autoFailback: boolean
  }
  candidates: LocalResourceCandidateView[]
  warnings: MappingWarning[]
}

export interface AuthorizedResourceView {
  id: string
  label: string
  enabled: boolean
}
