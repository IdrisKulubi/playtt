import type { DatabaseSync } from "node:sqlite"

import type { CaptureReplayPayload, UploadGrant } from "../cloud/client"
import type { EdgeConfigV2 } from "../cloud/config-v2"
import type {
  EdgeConfigSnapshotRow,
  EdgeConfigSnapshotSlot,
  PersistEdgeConfigSnapshotInput,
} from "../config/types"
import type { CommandStatus, ReplayJobStatus } from "../state/sqlite"
import type {
  SourceHealthRow,
  SourceHealthScope,
  SourceHealthStatus,
} from "../health/types"
import type { ReplayCaptureMode } from "../cloud/config-v2"
import type { CaptureAttemptStatus } from "../selection/select-source"

export interface CaptureAttemptRow {
  replayRequestId: string
  ordinal: number
  sourceId: string
  recorderId: string
  captureMode: ReplayCaptureMode
  status: CaptureAttemptStatus
  reasonCode: string | null
  configRevisionId: string | null
  startedAt: string | null
  completedAt: string | null
  details: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

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
  configRevisionId: string | null
  configSnapshot: EdgeConfigV2 | null
  lockedSourceId: string | null
  lockedCaptureMode: ReplayCaptureMode | null
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
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(
        input.id,
        input.kind,
        JSON.stringify(input.payload),
        input.correlationId,
        input.expiresAt,
        input.attemptCount,
        timestamp,
        timestamp
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
    idempotencyKey?: string
  ): void {
    this.db
      .prepare(
        `UPDATE edge_commands
         SET status = ?, result_json = ?, idempotency_key = COALESCE(?, idempotency_key), updated_at = ?
         WHERE id = ?`
      )
      .run(
        status,
        result ? JSON.stringify(result) : null,
        idempotencyKey ?? null,
        nowIso(),
        id
      )
  }

  createReplayJob(input: {
    commandId: string
    payload: CaptureReplayPayload
    configSnapshot?: EdgeConfigV2 | null
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
          source_type, status, upload_grant_json, config_revision_id,
          config_snapshot_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.payload.configRevisionId ?? null,
        input.configSnapshot ? JSON.stringify(input.configSnapshot) : null,
        timestamp,
        timestamp
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
         ORDER BY created_at ASC`
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
      lockedSourceId: string | null
      lockedCaptureMode: ReplayCaptureMode | null
    }>
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
      values.push(patch.uploadGrant ? JSON.stringify(patch.uploadGrant) : null)
    }

    if (patch.lockedSourceId !== undefined) {
      fields.push("locked_source_id = ?")
      values.push(patch.lockedSourceId)
    }

    if (patch.lockedCaptureMode !== undefined) {
      fields.push("locked_capture_mode = ?")
      values.push(patch.lockedCaptureMode)
    }

    fields.push("updated_at = ?")
    values.push(nowIso())
    values.push(replayRequestId)

    this.db
      .prepare(
        `UPDATE edge_replay_jobs SET ${fields.join(", ")} WHERE replay_request_id = ?`
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.cameraId,
        input.path,
        input.startedAt,
        input.endedAt,
        input.durationSeconds,
        nowIso()
      )
  }

  listBufferSegmentsForWindow(
    cameraId: string,
    windowStart: string,
    windowEnd: string
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
         ORDER BY started_at ASC`
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

  getConfigSnapshot(
    slot: EdgeConfigSnapshotSlot
  ): EdgeConfigSnapshotRow | null {
    const row = this.db
      .prepare(`SELECT * FROM edge_config_snapshots WHERE slot = ?`)
      .get(slot) as Record<string, unknown> | undefined

    return row ? mapConfigSnapshotRow(row) : null
  }

  getCurrentConfig(): EdgeConfigSnapshotRow | null {
    return this.getConfigSnapshot("current")
  }

  getPreviousConfig(): EdgeConfigSnapshotRow | null {
    return this.getConfigSnapshot("previous")
  }

  applyConfigSnapshot(
    input: PersistEdgeConfigSnapshotInput
  ): EdgeConfigSnapshotRow {
    this.db.exec("BEGIN IMMEDIATE")

    try {
      const current = this.getConfigSnapshot("current")

      if (current) {
        this.db
          .prepare(
            `INSERT OR REPLACE INTO edge_config_snapshots (
              slot, revision_id, version, checksum, installation_id,
              published_at, snapshot_json, applied_at, boot_id
            ) VALUES ('previous', ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            current.revisionId,
            current.version,
            current.checksum,
            current.installationId,
            current.publishedAt,
            JSON.stringify(current.snapshot),
            current.appliedAt,
            current.bootId
          )
      } else {
        this.db
          .prepare(`DELETE FROM edge_config_snapshots WHERE slot = 'previous'`)
          .run()
      }

      this.db
        .prepare(
          `INSERT OR REPLACE INTO edge_config_snapshots (
            slot, revision_id, version, checksum, installation_id,
            published_at, snapshot_json, applied_at, boot_id
          ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.revisionId,
          input.version,
          input.checksum,
          input.installationId,
          input.publishedAt,
          JSON.stringify(input.snapshot),
          input.appliedAt,
          input.bootId ?? null
        )

      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }

    return this.getCurrentConfig()!
  }

  rollbackToPrevious(): EdgeConfigSnapshotRow | null {
    const previous = this.getConfigSnapshot("previous")
    if (!previous) {
      return null
    }

    this.db.exec("BEGIN IMMEDIATE")

    try {
      const current = this.getConfigSnapshot("current")

      if (current) {
        this.db
          .prepare(
            `INSERT OR REPLACE INTO edge_config_snapshots (
              slot, revision_id, version, checksum, installation_id,
              published_at, snapshot_json, applied_at, boot_id
            ) VALUES ('previous', ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            current.revisionId,
            current.version,
            current.checksum,
            current.installationId,
            current.publishedAt,
            JSON.stringify(current.snapshot),
            current.appliedAt,
            current.bootId
          )
      }

      this.db
        .prepare(
          `INSERT OR REPLACE INTO edge_config_snapshots (
            slot, revision_id, version, checksum, installation_id,
            published_at, snapshot_json, applied_at, boot_id
          ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          previous.revisionId,
          previous.version,
          previous.checksum,
          previous.installationId,
          previous.publishedAt,
          JSON.stringify(previous.snapshot),
          previous.appliedAt,
          previous.bootId
        )

      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }

    return this.getCurrentConfig()
  }

  upsertSourceHealth(row: SourceHealthRow): SourceHealthRow {
    const timestamp = nowIso()
    const sourceId = row.sourceId ?? ""

    this.db
      .prepare(
        `INSERT INTO edge_source_health (
          scope, recorder_id, source_id, status, reason_code,
          consecutive_failures, consecutive_successes, cooldown_until,
          observed_at, last_success_at, failback_eligible, details_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope, recorder_id, source_id) DO UPDATE SET
          status = excluded.status,
          reason_code = excluded.reason_code,
          consecutive_failures = excluded.consecutive_failures,
          consecutive_successes = excluded.consecutive_successes,
          cooldown_until = excluded.cooldown_until,
          observed_at = excluded.observed_at,
          last_success_at = excluded.last_success_at,
          failback_eligible = excluded.failback_eligible,
          details_json = excluded.details_json,
          updated_at = excluded.updated_at`
      )
      .run(
        row.scope,
        row.recorderId,
        sourceId,
        row.status,
        row.reasonCode,
        row.consecutiveFailures,
        row.consecutiveSuccesses,
        row.cooldownUntil,
        row.observedAt,
        row.lastSuccessAt,
        row.failbackEligible ? 1 : 0,
        JSON.stringify(row.details),
        timestamp,
        timestamp
      )

    return this.getSourceHealthRow(row.scope, row.recorderId, row.sourceId)!
  }

  getSourceHealthRow(
    scope: SourceHealthScope,
    recorderId: string,
    sourceId: string | null
  ): SourceHealthRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM edge_source_health
         WHERE scope = ? AND recorder_id = ? AND source_id = ?`
      )
      .get(scope, recorderId, sourceId ?? "") as
      | Record<string, unknown>
      | undefined

    return row ? mapSourceHealthRow(row) : null
  }

  getSourceHealthBySourceId(sourceId: string): SourceHealthRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM edge_source_health
         WHERE scope = 'source' AND source_id = ?`
      )
      .get(sourceId) as Record<string, unknown> | undefined

    return row ? mapSourceHealthRow(row) : null
  }

  listSourceHealthByRecorder(recorderId: string): SourceHealthRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM edge_source_health
         WHERE recorder_id = ?
         ORDER BY scope ASC, source_id ASC`
      )
      .all(recorderId) as Record<string, unknown>[]

    return rows.map(mapSourceHealthRow)
  }

  listAllSourceHealth(): SourceHealthRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM edge_source_health
         WHERE scope = 'source'
         ORDER BY recorder_id ASC, source_id ASC`
      )
      .all() as Record<string, unknown>[]

    return rows.map(mapSourceHealthRow)
  }

  upsertCaptureAttempt(input: {
    replayRequestId: string
    ordinal: number
    sourceId: string
    recorderId: string
    captureMode: ReplayCaptureMode
    status: CaptureAttemptStatus
    reasonCode?: string | null
    configRevisionId?: string | null
    startedAt?: string | null
    completedAt?: string | null
    details?: Record<string, unknown>
  }): CaptureAttemptRow {
    const timestamp = nowIso()
    const existing = this.getCaptureAttempt(
      input.replayRequestId,
      input.ordinal
    )

    if (existing) {
      this.updateCaptureAttempt(input.replayRequestId, input.ordinal, {
        status: input.status,
        reasonCode: input.reasonCode,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        details: input.details,
      })
      return this.getCaptureAttempt(input.replayRequestId, input.ordinal)!
    }

    this.db
      .prepare(
        `INSERT INTO edge_capture_attempts (
          replay_request_id, ordinal, source_id, recorder_id, capture_mode,
          status, reason_code, config_revision_id, started_at, completed_at,
          details_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.replayRequestId,
        input.ordinal,
        input.sourceId,
        input.recorderId,
        input.captureMode,
        input.status,
        input.reasonCode ?? null,
        input.configRevisionId ?? null,
        input.startedAt ?? null,
        input.completedAt ?? null,
        JSON.stringify(input.details ?? {}),
        timestamp,
        timestamp
      )

    return this.getCaptureAttempt(input.replayRequestId, input.ordinal)!
  }

  getCaptureAttempt(
    replayRequestId: string,
    ordinal: number
  ): CaptureAttemptRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM edge_capture_attempts
         WHERE replay_request_id = ? AND ordinal = ?`
      )
      .get(replayRequestId, ordinal) as Record<string, unknown> | undefined

    return row ? mapCaptureAttemptRow(row) : null
  }

  updateCaptureAttempt(
    replayRequestId: string,
    ordinal: number,
    patch: Partial<{
      status: CaptureAttemptStatus
      reasonCode: string | null
      startedAt: string | null
      completedAt: string | null
      details: Record<string, unknown>
    }>
  ): void {
    const fields: string[] = []
    const values: unknown[] = []

    if (patch.status !== undefined) {
      fields.push("status = ?")
      values.push(patch.status)
    }

    if (patch.reasonCode !== undefined) {
      fields.push("reason_code = ?")
      values.push(patch.reasonCode)
    }

    if (patch.startedAt !== undefined) {
      fields.push("started_at = ?")
      values.push(patch.startedAt)
    }

    if (patch.completedAt !== undefined) {
      fields.push("completed_at = ?")
      values.push(patch.completedAt)
    }

    if (patch.details !== undefined) {
      fields.push("details_json = ?")
      values.push(JSON.stringify(patch.details))
    }

    fields.push("updated_at = ?")
    values.push(nowIso())
    values.push(replayRequestId, ordinal)

    this.db
      .prepare(
        `UPDATE edge_capture_attempts SET ${fields.join(", ")}
         WHERE replay_request_id = ? AND ordinal = ?`
      )
      .run(...(values as (string | number | null)[]))
  }

  listCaptureAttempts(replayRequestId: string): CaptureAttemptRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM edge_capture_attempts
         WHERE replay_request_id = ?
         ORDER BY ordinal ASC`
      )
      .all(replayRequestId) as Record<string, unknown>[]

    return rows.map(mapCaptureAttemptRow)
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
    configRevisionId: row.config_revision_id
      ? String(row.config_revision_id)
      : null,
    configSnapshot: row.config_snapshot_json
      ? (JSON.parse(String(row.config_snapshot_json)) as EdgeConfigV2)
      : null,
    lockedSourceId: row.locked_source_id ? String(row.locked_source_id) : null,
    lockedCaptureMode: row.locked_capture_mode
      ? (String(row.locked_capture_mode) as ReplayCaptureMode)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapCaptureAttemptRow(row: Record<string, unknown>): CaptureAttemptRow {
  return {
    replayRequestId: String(row.replay_request_id),
    ordinal: Number(row.ordinal),
    sourceId: String(row.source_id),
    recorderId: String(row.recorder_id),
    captureMode: String(row.capture_mode) as ReplayCaptureMode,
    status: row.status as CaptureAttemptStatus,
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    configRevisionId: row.config_revision_id
      ? String(row.config_revision_id)
      : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    details: JSON.parse(String(row.details_json ?? "{}")) as Record<
      string,
      unknown
    >,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapConfigSnapshotRow(
  row: Record<string, unknown>
): EdgeConfigSnapshotRow {
  return {
    slot: row.slot as EdgeConfigSnapshotSlot,
    revisionId: String(row.revision_id),
    version: Number(row.version),
    checksum: String(row.checksum),
    installationId: String(row.installation_id),
    publishedAt: String(row.published_at),
    snapshot: JSON.parse(String(row.snapshot_json)) as EdgeConfigV2,
    appliedAt: String(row.applied_at),
    bootId: row.boot_id ? String(row.boot_id) : null,
  }
}

function mapSourceHealthRow(row: Record<string, unknown>): SourceHealthRow {
  const sourceId = String(row.source_id)

  return {
    scope: row.scope as SourceHealthScope,
    recorderId: String(row.recorder_id),
    sourceId: sourceId.length > 0 ? sourceId : null,
    status: row.status as SourceHealthStatus,
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    consecutiveFailures: Number(row.consecutive_failures),
    consecutiveSuccesses: Number(row.consecutive_successes),
    cooldownUntil: row.cooldown_until ? String(row.cooldown_until) : null,
    observedAt: String(row.observed_at),
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
    failbackEligible: Boolean(row.failback_eligible),
    details: JSON.parse(String(row.details_json)) as Record<string, unknown>,
  }
}
