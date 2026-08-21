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

const snap19 = readJson(join(metaDirectory, "0019_snapshot.json"))

const mediaAssets = table(
  "media_assets",
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
    owner_user_id: column("owner_user_id", "text", { notNull: true }),
    object_key: column("object_key", "text", { notNull: true }),
    kind: column("kind", "media_kind", { notNull: true, typeSchema: "public" }),
    content_type: column("content_type", "text"),
    size_bytes: column("size_bytes", "integer"),
    checksum_sha256: column("checksum_sha256", "text"),
    expected_content_type: column("expected_content_type", "text", {
      notNull: true,
    }),
    expected_max_bytes: column("expected_max_bytes", "integer", {
      notNull: true,
    }),
    status: column("status", "media_status", {
      notNull: true,
      default: "'pending_upload'",
      typeSchema: "public",
    }),
    retention_class: column("retention_class", "media_retention_class", {
      notNull: true,
      default: "'replay_standard'",
      typeSchema: "public",
    }),
    uploaded_at: column("uploaded_at", "timestamp with time zone"),
    ready_at: column("ready_at", "timestamp with time zone"),
    deletion_requested_at: column("deletion_requested_at", "timestamp with time zone"),
    deleted_at: column("deleted_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    media_assets_object_key_unique: index("media_assets_object_key_unique", [
      "object_key",
    ], { isUnique: true }),
    media_assets_tenant_id_unique: index(
      "media_assets_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    media_assets_tenant_id_idx: index("media_assets_tenant_id_idx", ["tenant_id"]),
    media_assets_play_session_id_idx: index("media_assets_play_session_id_idx", [
      "play_session_id",
    ]),
    media_assets_owner_user_id_idx: index("media_assets_owner_user_id_idx", [
      "owner_user_id",
    ]),
    media_assets_status_idx: index("media_assets_status_idx", ["status"]),
  },
  {
    media_assets_tenant_id_tenants_id_fk: fk(
      "media_assets_tenant_id_tenants_id_fk",
      "media_assets",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    media_assets_location_id_locations_id_fk: fk(
      "media_assets_location_id_locations_id_fk",
      "media_assets",
      "locations",
      ["location_id"],
      ["id"],
    ),
    media_assets_resource_id_resources_id_fk: fk(
      "media_assets_resource_id_resources_id_fk",
      "media_assets",
      "resources",
      ["resource_id"],
      ["id"],
    ),
    media_assets_play_session_id_play_sessions_id_fk: fk(
      "media_assets_play_session_id_play_sessions_id_fk",
      "media_assets",
      "play_sessions",
      ["play_session_id"],
      ["id"],
    ),
    media_assets_owner_user_id_user_id_fk: fk(
      "media_assets_owner_user_id_user_id_fk",
      "media_assets",
      "user",
      ["owner_user_id"],
      ["id"],
    ),
  },
)

const mediaEventInbox = table(
  "media_event_inbox",
  {
    id: column("id", "uuid", {
      primaryKey: true,
      notNull: true,
      default: "gen_random_uuid()",
    }),
    tenant_id: column("tenant_id", "uuid"),
    media_id: column("media_id", "uuid", { notNull: true }),
    event_type: column("event_type", "text", { notNull: true }),
    payload_hash: column("payload_hash", "text", { notNull: true }),
    raw_payload: column("raw_payload", "text", { notNull: true }),
    status: column("status", "media_event_inbox_status", {
      notNull: true,
      default: "'received'",
      typeSchema: "public",
    }),
    attempts: column("attempts", "integer", { notNull: true, default: "0" }),
    last_error: column("last_error", "text"),
    available_at: column("available_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    lease_expires_at: column("lease_expires_at", "timestamp with time zone"),
    lease_owner: column("lease_owner", "text"),
    received_at: column("received_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    processed_at: column("processed_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    media_event_inbox_media_event_payload_unique: index(
      "media_event_inbox_media_event_payload_unique",
      ["media_id", "event_type", "payload_hash"],
      { isUnique: true },
    ),
    media_event_inbox_status_received_idx: index(
      "media_event_inbox_status_received_idx",
      ["status", "received_at"],
    ),
    media_event_inbox_claim_idx: index("media_event_inbox_claim_idx", [
      "status",
      "available_at",
    ]),
    media_event_inbox_media_id_idx: index("media_event_inbox_media_id_idx", [
      "media_id",
    ]),
  },
  {
    media_event_inbox_tenant_id_tenants_id_fk: fk(
      "media_event_inbox_tenant_id_tenants_id_fk",
      "media_event_inbox",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    media_event_inbox_media_id_media_assets_id_fk: fk(
      "media_event_inbox_media_id_media_assets_id_fk",
      "media_event_inbox",
      "media_assets",
      ["media_id"],
      ["id"],
    ),
  },
)

const replaysTable = snap19.tables["public.replays"]
const replaysWithMedia = {
  ...replaysTable,
  columns: {
    ...replaysTable.columns,
    media_asset_id: column("media_asset_id", "uuid"),
  },
  indexes: {
    ...replaysTable.indexes,
    replays_media_asset_id_idx: index("replays_media_asset_id_idx", [
      "media_asset_id",
    ]),
  },
  foreignKeys: {
    ...replaysTable.foreignKeys,
    replays_media_asset_id_media_assets_id_fk: fk(
      "replays_media_asset_id_media_assets_id_fk",
      "replays",
      "media_assets",
      ["media_asset_id"],
      ["id"],
      "set null",
    ),
  },
}

const snap20 = cloneSnapshot(snap19, {
  tables: {
    "public.media_assets": mediaAssets,
    "public.media_event_inbox": mediaEventInbox,
    "public.replays": replaysWithMedia,
  },
  enums: {
    "public.media_kind": {
      name: "media_kind",
      schema: "public",
      values: ["source_video", "preview_image", "derived_video"],
    },
    "public.media_status": {
      name: "media_status",
      schema: "public",
      values: [
        "pending_upload",
        "uploaded",
        "ready",
        "failed",
        "deletion_pending",
        "deleted",
      ],
    },
    "public.media_retention_class": {
      name: "media_retention_class",
      schema: "public",
      values: ["session_short", "replay_standard", "replay_owned"],
    },
    "public.media_event_inbox_status": {
      name: "media_event_inbox_status",
      schema: "public",
      values: ["received", "processing", "processed", "failed", "dead_letter"],
    },
  },
})

snap20.id = randomUUID()
snap20.prevId = snap19.id

writeJson(join(metaDirectory, "0020_snapshot.json"), snap20)

console.log("Wrote drizzle/meta/0020_snapshot.json")
