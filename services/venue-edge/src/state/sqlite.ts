import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export type CommandStatus =
  | "pending"
  | "delivered"
  | "acknowledged"
  | "failed"
  | "rejected"

export type ReplayJobStatus =
  | "pending"
  | "edge_acknowledged"
  | "capturing"
  | "extracting"
  | "uploading"
  | "verifying"
  | "ready"
  | "failed"

export interface EdgeDatabase {
  db: DatabaseSync
  close(): void
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS edge_commands (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS edge_commands_status_idx ON edge_commands(status);

CREATE TABLE IF NOT EXISTS edge_replay_jobs (
  replay_request_id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL,
  replay_id TEXT NOT NULL,
  media_asset_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  play_session_id TEXT NOT NULL,
  capture_at TEXT NOT NULL,
  pre_roll_seconds INTEGER NOT NULL,
  post_roll_seconds INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  local_clip_path TEXT,
  upload_grant_json TEXT,
  config_revision_id TEXT,
  config_snapshot_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS edge_replay_jobs_status_idx ON edge_replay_jobs(status);

CREATE TABLE IF NOT EXISTS edge_buffer_segments (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS edge_buffer_segments_camera_started_idx
  ON edge_buffer_segments(camera_id, started_at);

CREATE TABLE IF NOT EXISTS edge_config_snapshots (
  slot TEXT PRIMARY KEY CHECK (slot IN ('current', 'previous')),
  revision_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  published_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  boot_id TEXT
);

CREATE TABLE IF NOT EXISTS edge_source_health (
  scope TEXT NOT NULL CHECK (scope IN ('recorder', 'source')),
  recorder_id TEXT NOT NULL,
  source_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('unknown', 'healthy', 'degraded', 'unhealthy', 'disabled')),
  reason_code TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  cooldown_until TEXT,
  observed_at TEXT NOT NULL,
  last_success_at TEXT,
  failback_eligible INTEGER NOT NULL DEFAULT 0,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, recorder_id, source_id)
);

CREATE INDEX IF NOT EXISTS edge_source_health_recorder_idx
  ON edge_source_health(recorder_id);

CREATE TABLE IF NOT EXISTS edge_capture_attempts (
  replay_request_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  recorder_id TEXT NOT NULL,
  capture_mode TEXT NOT NULL CHECK (capture_mode IN ('edge_buffer', 'nvr_playback')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'skipped', 'succeeded', 'failed')),
  reason_code TEXT,
  config_revision_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (replay_request_id, ordinal)
);

CREATE INDEX IF NOT EXISTS edge_capture_attempts_replay_idx
  ON edge_capture_attempts(replay_request_id);

CREATE TABLE IF NOT EXISTS edge_local_nvrs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  vendor TEXT NOT NULL CHECK (vendor IN ('vigi')),
  host TEXT NOT NULL,
  rtsp_port INTEGER NOT NULL,
  playback_port INTEGER,
  username TEXT NOT NULL,
  local_connection_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  test_channel_key TEXT NOT NULL DEFAULT '1',
  time_mode TEXT NOT NULL DEFAULT 'unknown' CHECK (time_mode IN ('z', 'l', 'unknown')),
  last_test_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (rtsp_port > 0 AND rtsp_port <= 65535),
  CHECK (playback_port IS NULL OR (playback_port > 0 AND playback_port <= 65535))
);

CREATE INDEX IF NOT EXISTS edge_local_nvrs_enabled_idx
  ON edge_local_nvrs(enabled);

CREATE TABLE IF NOT EXISTS edge_local_cameras (
  id TEXT PRIMARY KEY,
  nvr_id TEXT NOT NULL REFERENCES edge_local_nvrs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  stream_profile TEXT NOT NULL CHECK (stream_profile IN ('main', 'sub')),
  codec TEXT NOT NULL DEFAULT 'unknown' CHECK (codec IN ('h264', 'h265', 'unknown')),
  enabled INTEGER NOT NULL DEFAULT 0,
  last_test_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (nvr_id, channel_key, stream_profile)
);

CREATE INDEX IF NOT EXISTS edge_local_cameras_nvr_idx
  ON edge_local_cameras(nvr_id);

CREATE INDEX IF NOT EXISTS edge_local_cameras_enabled_idx
  ON edge_local_cameras(enabled);

CREATE TABLE IF NOT EXISTS edge_local_resource_policies (
  resource_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('automatic', 'manual')),
  manual_source_id TEXT,
  failure_threshold INTEGER NOT NULL DEFAULT 3,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  healthy_threshold INTEGER NOT NULL DEFAULT 2,
  auto_failback INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edge_local_resource_routes (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES edge_local_resource_policies(resource_id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL REFERENCES edge_local_cameras(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL,
  capture_modes_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (resource_id, camera_id),
  UNIQUE (resource_id, priority)
);

CREATE INDEX IF NOT EXISTS edge_local_resource_routes_resource_idx
  ON edge_local_resource_routes(resource_id);

CREATE TABLE IF NOT EXISTS edge_commissioning_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  published_at TEXT,
  failover_ready INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  drill_results_json TEXT,
  updated_at TEXT NOT NULL
);
`

function migrateSchema(db: DatabaseSync): void {
  const replayColumns = db
    .prepare(`PRAGMA table_info(edge_replay_jobs)`)
    .all() as Array<{ name: string }>

  const columnNames = new Set(replayColumns.map((column) => column.name))

  if (!columnNames.has("locked_source_id")) {
    db.exec(`ALTER TABLE edge_replay_jobs ADD COLUMN locked_source_id TEXT`)
  }

  if (!columnNames.has("locked_capture_mode")) {
    db.exec(`ALTER TABLE edge_replay_jobs ADD COLUMN locked_capture_mode TEXT`)
  }

  if (!columnNames.has("config_revision_id")) {
    db.exec(`ALTER TABLE edge_replay_jobs ADD COLUMN config_revision_id TEXT`)
  }

  if (!columnNames.has("config_snapshot_json")) {
    db.exec(`ALTER TABLE edge_replay_jobs ADD COLUMN config_snapshot_json TEXT`)
  }

  const commissioning = db
    .prepare(`SELECT id FROM edge_commissioning_state WHERE id = 1`)
    .get() as { id: number } | undefined

  if (!commissioning) {
    db.exec(
      `INSERT INTO edge_commissioning_state (id, completed, failover_ready, updated_at)
       VALUES (1, 0, 0, datetime('now'))`,
    )
  }
}

export function initDatabase(sqlitePath: string): EdgeDatabase {
  mkdirSync(dirname(sqlitePath), { recursive: true })

  const db = new DatabaseSync(sqlitePath)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec(SCHEMA)
  migrateSchema(db)

  return {
    db,
    close() {
      db.close()
    },
  }
}
