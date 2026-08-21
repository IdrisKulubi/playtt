import type { DatabaseSync } from "node:sqlite"

import type {
  CaptureReplayPayload,
  UploadGrant,
} from "../cloud/client"
import type { CommandStatus, ReplayJobStatus } from "../state/sqlite"

export interface EdgeCommandRow {
  id: string
  kind: string
  payload: CaptureReplayPayload
  correlationId: string
  expiresAt: string
  attemptCount: number
  status: CommandStatus
  idempotencyKey: string | null
  result: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface ReplayJobRow {
  replayRequestId: string
  commandId: string
  replayId: string
  mediaAssetId: string
  objectKey: string
  resourceId: string
  playSessionId: string
  captureAt: string
  preRollSeconds: number
  postRollSeconds: number
  sourceType: string
  status: ReplayJobStatus
  failureReason: string | null
  localClipPath: string | null
  uploadGrant: UploadGrant | null
  createdAt: string
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

export class EdgeRepositories {
  constructor(private readonly db: DatabaseSync) {}

  upsertCommand(input: {
    id: string
    kind: string
    payload: CaptureReplayPayload
    correlationId: string
    expiresAt: string
    attemptCount: number
  }): EdgeCommandRow {
    const existing = this.getCommandById(input.id)
    if (existing) {
      return existing
    }

    const timestamp = nowIso()

    this.db
      .prepare(
        `INSERT INTO edge_commands (
          id, kind, payload_json, correlation_id, expires_at, attempt_count,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        input.id,
        input.kind,
        JSON.stringify(input.payload),
        input.correlationId,
        input.expiresAt,
        input.attemptCount,
        timestamp,
        timestamp,
      )

    return this.getCommandById(input.id)!
  }

  getCommandById(id: string): EdgeCommandRow | null {
    const row = this.db
      .prepare(`SELECT * FROM edge_commands WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined

    return row ? mapCommandRow(row) : null
  }

  updateCommandStatus(
    id: string,
    status: CommandStatus,
    result?: Record<string, unknown>,
    idempotencyKey?: string,
  ): void {
    this.db
      .prepare(
        `UPDATE edge_commands
         SET status = ?, result_json = ?, idempotency_key = COALESCE(?, idempotency_key), updated_at = ?
         WHERE id = ?`,
      )
      .run(
        status,
        result ? JSON.stringify(result) : null,
        idempotencyKey ?? null,
        nowIso(),
        id,
      )
  }

  createReplayJob(input: {
    commandId: string
    payload: CaptureReplayPayload
    status?: ReplayJobStatus
  }): ReplayJobRow {
    const existing = this.getReplayJob(input.payload.replayRequestId)
    if (existing) {
      return existing
    }

    const timestamp = nowIso()

    this.db
      .prepare(
        `INSERT INTO edge_replay_jobs (
          replay_request_id, command_id, replay_id, media_asset_id, object_key,
          resource_id, play_session_id, capture_at, pre_roll_seconds, post_roll_seconds,
          source_type, status, upload_grant_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.payload.replayRequestId,
        input.commandId,
        input.payload.replayId,
        input.payload.mediaAssetId,
        input.payload.objectKey,
        input.payload.resourceId,
        input.payload.playSessionId,
        input.payload.captureAt,
        input.payload.preRollSeconds,
        input.payload.postRollSeconds,
        input.payload.sourceType,
        input.status ?? "pending",
        JSON.stringify(input.payload.uploadGrant),
        timestamp,
        timestamp,
      )

    return this.getReplayJob(input.payload.replayRequestId)!
  }

  getReplayJob(replayRequestId: string): ReplayJobRow | null {
    const row = this.db
      .prepare(`SELECT * FROM edge_replay_jobs WHERE replay_request_id = ?`)
      .get(replayRequestId) as Record<string, unknown> | undefined

    return row ? mapReplayJobRow(row) : null
  }

  listUnfinishedReplayJobs(): ReplayJobRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM edge_replay_jobs
         WHERE status NOT IN ('ready', 'failed')
         ORDER BY created_at ASC`,
      )
      .all() as Record<string, unknown>[]

    return rows.map(mapReplayJobRow)
  }

  updateReplayJob(
    replayRequestId: string,
    patch: Partial<{
      status: ReplayJobStatus
      failureReason: string | null
      localClipPath: string | null
      uploadGrant: UploadGrant | null
    }>,
  ): void {
    const fields: string[] = []
    const values: unknown[] = []

    if (patch.status !== undefined) {
      fields.push("status = ?")
      values.push(patch.status)
    }

    if (patch.failureReason !== undefined) {
      fields.push("failure_reason = ?")
      values.push(patch.failureReason)
    }

    if (patch.localClipPath !== undefined) {
      fields.push("local_clip_path = ?")
      values.push(patch.localClipPath)
    }

    if (patch.uploadGrant !== undefined) {
      fields.push("upload_grant_json = ?")
      values.push(
        patch.uploadGrant ? JSON.stringify(patch.uploadGrant) : null,
      )
    }

    fields.push("updated_at = ?")
    values.push(nowIso())
    values.push(replayRequestId)

    this.db
      .prepare(
        `UPDATE edge_replay_jobs SET ${fields.join(", ")} WHERE replay_request_id = ?`,
      )
      .run(...(values as (string | number | null)[]))
  }

  recordBufferSegment(input: {
    id: string
    cameraId: string
    path: string
    startedAt: string
    endedAt: string
    durationSeconds: number
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO edge_buffer_segments (
          id, camera_id, path, started_at, ended_at, duration_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.cameraId,
        input.path,
        input.startedAt,
        input.endedAt,
        input.durationSeconds,
        nowIso(),
      )
  }

  listBufferSegmentsForWindow(
    cameraId: string,
    windowStart: string,
    windowEnd: string,
  ): Array<{
    id: string
    path: string
    startedAt: string
    endedAt: string
    durationSeconds: number
  }> {
    const rows = this.db
      .prepare(
        `SELECT id, path, started_at, ended_at, duration_seconds
         FROM edge_buffer_segments
         WHERE camera_id = ?
           AND ended_at >= ?
           AND started_at <= ?
         ORDER BY started_at ASC`,
      )
      .all(cameraId, windowStart, windowEnd) as Record<string, unknown>[]

    return rows.map((row) => ({
      id: String(row.id),
      path: String(row.path),
      startedAt: String(row.started_at),
      endedAt: String(row.ended_at),
      durationSeconds: Number(row.duration_seconds),
    }))
  }
}

function mapCommandRow(row: Record<string, unknown>): EdgeCommandRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    payload: JSON.parse(String(row.payload_json)) as CaptureReplayPayload,
    correlationId: String(row.correlation_id),
    expiresAt: String(row.expires_at),
    attemptCount: Number(row.attempt_count),
    status: row.status as CommandStatus,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    result: row.result_json
      ? (JSON.parse(String(row.result_json)) as Record<string, unknown>)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapReplayJobRow(row: Record<string, unknown>): ReplayJobRow {
  return {
    replayRequestId: String(row.replay_request_id),
    commandId: String(row.command_id),
    replayId: String(row.replay_id),
    mediaAssetId: String(row.media_asset_id),
    objectKey: String(row.object_key),
    resourceId: String(row.resource_id),
    playSessionId: String(row.play_session_id),
    captureAt: String(row.capture_at),
    preRollSeconds: Number(row.pre_roll_seconds),
    postRollSeconds: Number(row.post_roll_seconds),
    sourceType: String(row.source_type),
    status: row.status as ReplayJobStatus,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    localClipPath: row.local_clip_path ? String(row.local_clip_path) : null,
    uploadGrant: row.upload_grant_json
      ? (JSON.parse(String(row.upload_grant_json)) as UploadGrant)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
