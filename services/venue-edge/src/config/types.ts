import type { EdgeConfigV2 } from "../cloud/config-v2"

export type EdgeConfigSnapshotSlot = "current" | "previous"

export interface EdgeConfigSnapshotRow {
  slot: EdgeConfigSnapshotSlot
  revisionId: string
  version: number
  checksum: string
  installationId: string
  publishedAt: string
  snapshot: EdgeConfigV2
  appliedAt: string
  bootId: string | null
}

export interface PersistEdgeConfigSnapshotInput {
  revisionId: string
  version: number
  checksum: string
  installationId: string
  publishedAt: string
  snapshot: EdgeConfigV2
  appliedAt: string
  bootId?: string | null
}
