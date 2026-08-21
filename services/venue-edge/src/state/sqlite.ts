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
`

export function initDatabase(sqlitePath: string): EdgeDatabase {
  mkdirSync(dirname(sqlitePath), { recursive: true })

  const db = new DatabaseSync(sqlitePath)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec(SCHEMA)

  return {
    db,
    close() {
      db.close()
    },
  }
}
