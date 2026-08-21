import { randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const metaDirectory = join(root, "drizzle", "meta")

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function column(name, type, extras = {}) {
  return {
    name,
    type,
    primaryKey: extras.primaryKey ?? false,
    notNull: extras.notNull ?? false,
    ...(extras.default !== undefined ? { default: extras.default } : {}),
    ...(extras.typeSchema ? { typeSchema: extras.typeSchema } : {}),
  }
}

function index(name, columns, extras = {}) {
  return {
    name,
    columns: columns.map((expression) => ({
      expression,
      isExpression: false,
      asc: true,
      nulls: "last",
    })),
    isUnique: extras.isUnique ?? false,
    ...(extras.where ? { where: extras.where } : {}),
    concurrently: false,
    method: "btree",
    with: {},
  }
}

function fk(name, tableFrom, tableTo, columnsFrom, columnsTo, onDelete = "restrict") {
  return {
    name,
    tableFrom,
    tableTo,
    columnsFrom,
    columnsTo,
    onDelete,
    onUpdate: "no action",
  }
}

function table(name, columns, indexes, foreignKeys) {
  return {
    name,
    schema: "",
    columns,
    indexes,
    foreignKeys,
    compositePrimaryKeys: {},
    uniqueConstraints: {},
    policies: {},
    checkConstraints: {},
    isRLSEnabled: false,
  }
}

const timestamps = {
  created_at: column("created_at", "timestamp with time zone", {
    notNull: true,
    default: "now()",
  }),
  updated_at: column("updated_at", "timestamp with time zone", {
    notNull: true,
    default: "now()",
  }),
}

function cloneSnapshot(base, patch) {
  return {
    ...base,
    ...patch,
    tables: {
      ...base.tables,
      ...(patch.tables ?? {}),
    },
    enums: {
      ...base.enums,
      ...(patch.enums ?? {}),
    },
  }
}

const snap20 = readJson(join(metaDirectory, "0020_snapshot.json"))

const replayRequests = table(
  "replay_requests",
  {
    id: column("id", "uuid", {
      primaryKey: true,
      notNull: true,
      default: "gen_random_uuid()",
    }),
    tenant_id: column("tenant_id", "uuid", {
      notNull: true,
      default: "'33333333-3333-3333-3333-333333333333'",
    }),
    location_id: column("location_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid", { notNull: true }),
    play_session_id: column("play_session_id", "uuid", { notNull: true }),
    booking_id: column("booking_id", "uuid", { notNull: true }),
    requester_user_id: column("requester_user_id", "text", { notNull: true }),
    replay_id: column("replay_id", "uuid", { notNull: true }),
    media_asset_id: column("media_asset_id", "uuid", { notNull: true }),
    venue_edge_device_id: column("venue_edge_device_id", "uuid"),
    camera_device_id: column("camera_device_id", "uuid"),
    assignment_id: column("assignment_id", "uuid"),
    source_type: column("source_type", "replay_capture_source", {
      notNull: true,
      typeSchema: "public",
    }),
    capture_at: column("capture_at", "timestamp with time zone", { notNull: true }),
    pre_roll_seconds: column("pre_roll_seconds", "integer", {
      notNull: true,
      default: "12",
    }),
    post_roll_seconds: column("post_roll_seconds", "integer", {
      notNull: true,
      default: "3",
    }),
    status: column("status", "replay_request_status", {
      notNull: true,
      default: "'requested'",
      typeSchema: "public",
    }),
    attempts: column("attempts", "integer", { notNull: true, default: "0" }),
    max_attempts: column("max_attempts", "integer", { notNull: true, default: "3" }),
    correlation_id: column("correlation_id", "text", { notNull: true }),
    client_idempotency_key: column("client_idempotency_key", "text", {
      notNull: true,
    }),
    device_command_id: column("device_command_id", "uuid"),
    failure_reason: column("failure_reason", "text"),
    dispatched_at: column("dispatched_at", "timestamp with time zone"),
    edge_acknowledged_at: column("edge_acknowledged_at", "timestamp with time zone"),
    capturing_at: column("capturing_at", "timestamp with time zone"),
    extracting_at: column("extracting_at", "timestamp with time zone"),
    uploading_at: column("uploading_at", "timestamp with time zone"),
    verifying_at: column("verifying_at", "timestamp with time zone"),
    ready_at: column("ready_at", "timestamp with time zone"),
    failed_at: column("failed_at", "timestamp with time zone"),
    expired_at: column("expired_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    replay_requests_tenant_id_unique: index(
      "replay_requests_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    replay_requests_requester_session_idempotency_unique: index(
      "replay_requests_requester_session_idempotency_unique",
      ["tenant_id", "requester_user_id", "play_session_id", "client_idempotency_key"],
      { isUnique: true },
    ),
    replay_requests_tenant_id_idx: index("replay_requests_tenant_id_idx", ["tenant_id"]),
    replay_requests_play_session_id_idx: index("replay_requests_play_session_id_idx", [
      "play_session_id",
    ]),
    replay_requests_replay_id_idx: index("replay_requests_replay_id_idx", ["replay_id"]),
    replay_requests_status_idx: index("replay_requests_status_idx", ["status"]),
  },
  {
    replay_requests_tenant_id_tenants_id_fk: fk(
      "replay_requests_tenant_id_tenants_id_fk",
      "replay_requests",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    replay_requests_location_id_locations_id_fk: fk(
      "replay_requests_location_id_locations_id_fk",
      "replay_requests",
      "locations",
      ["location_id"],
      ["id"],
    ),
    replay_requests_resource_id_resources_id_fk: fk(
      "replay_requests_resource_id_resources_id_fk",
      "replay_requests",
      "resources",
      ["resource_id"],
      ["id"],
    ),
    replay_requests_play_session_id_play_sessions_id_fk: fk(
      "replay_requests_play_session_id_play_sessions_id_fk",
      "replay_requests",
      "play_sessions",
      ["play_session_id"],
      ["id"],
    ),
    replay_requests_booking_id_bookings_id_fk: fk(
      "replay_requests_booking_id_bookings_id_fk",
      "replay_requests",
      "bookings",
      ["booking_id"],
      ["id"],
    ),
    replay_requests_requester_user_id_user_id_fk: fk(
      "replay_requests_requester_user_id_user_id_fk",
      "replay_requests",
      "user",
      ["requester_user_id"],
      ["id"],
    ),
    replay_requests_replay_id_replays_id_fk: fk(
      "replay_requests_replay_id_replays_id_fk",
      "replay_requests",
      "replays",
      ["replay_id"],
      ["id"],
    ),
    replay_requests_media_asset_id_media_assets_id_fk: fk(
      "replay_requests_media_asset_id_media_assets_id_fk",
      "replay_requests",
      "media_assets",
      ["media_asset_id"],
      ["id"],
    ),
    replay_requests_venue_edge_device_id_devices_id_fk: fk(
      "replay_requests_venue_edge_device_id_devices_id_fk",
      "replay_requests",
      "devices",
      ["venue_edge_device_id"],
      ["id"],
      "set null",
    ),
    replay_requests_camera_device_id_devices_id_fk: fk(
      "replay_requests_camera_device_id_devices_id_fk",
      "replay_requests",
      "devices",
      ["camera_device_id"],
      ["id"],
      "set null",
    ),
    replay_requests_assignment_id_device_assignments_id_fk: fk(
      "replay_requests_assignment_id_device_assignments_id_fk",
      "replay_requests",
      "device_assignments",
      ["assignment_id"],
      ["id"],
      "set null",
    ),
    replay_requests_device_command_id_device_commands_id_fk: fk(
      "replay_requests_device_command_id_device_commands_id_fk",
      "replay_requests",
      "device_commands",
      ["device_command_id"],
      ["id"],
      "set null",
    ),
  },
)

const snap21 = cloneSnapshot(snap20, {
  tables: {
    "public.replay_requests": replayRequests,
  },
  enums: {
    "public.device_type": {
      name: "device_type",
      schema: "public",
      values: [
        "esp32_controller",
        "ttlock_lock",
        "ttlock_gateway",
        "venue_edge",
        "camera",
      ],
    },
    "public.device_assignment_role": {
      name: "device_assignment_role",
      schema: "public",
      values: [
        "score_input",
        "lock",
        "gateway",
        "display",
        "venue_edge",
        "replay_primary",
        "replay_secondary",
        "security_camera",
      ],
    },
    "public.device_command_kind": {
      name: "device_command_kind",
      schema: "public",
      values: ["apply_config", "reset", "reboot", "capture_replay"],
    },
    "public.replay_request_status": {
      name: "replay_request_status",
      schema: "public",
      values: [
        "requested",
        "authorized",
        "dispatched",
        "edge_acknowledged",
        "capturing",
        "extracting",
        "uploading",
        "verifying",
        "ready",
        "edge_offline",
        "buffer_missing",
        "extraction_failed",
        "upload_failed",
        "expired",
        "failed",
      ],
    },
    "public.replay_capture_source": {
      name: "replay_capture_source",
      schema: "public",
      values: ["edge_buffer", "nvr_playback"],
    },
  },
})

snap21.id = randomUUID()
snap21.prevId = snap20.id

writeJson(join(metaDirectory, "0021_snapshot.json"), snap21)

console.log("Wrote drizzle/meta/0021_snapshot.json")
