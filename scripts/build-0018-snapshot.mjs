import { createHash } from "node:crypto"
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

const tenantDefault = "'33333333-3333-3333-3333-333333333333'::uuid"
const scoreEventKind = {
  name: "score_event_kind",
  schema: "public",
  values: ["point", "correction"],
}
const scoreSide = {
  name: "score_side",
  schema: "public",
  values: ["a", "b"],
}

const scoreEvents = table(
  "score_events",
  {
    id: column("id", "uuid", { primaryKey: true, notNull: true, default: "gen_random_uuid()" }),
    tenant_id: column("tenant_id", "uuid", { notNull: true, default: tenantDefault }),
    device_id: column("device_id", "uuid", { notNull: true }),
    play_session_id: column("play_session_id", "uuid", { notNull: true }),
    assignment_id: column("assignment_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid", { notNull: true }),
    location_id: column("location_id", "uuid", { notNull: true }),
    boot_id: column("boot_id", "text", { notNull: true }),
    sequence: column("sequence", "integer", { notNull: true }),
    kind: column("kind", "score_event_kind", {
      notNull: true,
      typeSchema: "public",
    }),
    side: column("side", "score_side", { notNull: true, typeSchema: "public" }),
    delta: column("delta", "integer", { notNull: true, default: "1" }),
    ruleset: column("ruleset", "text", { notNull: true }),
    correlation_id: column("correlation_id", "text", { notNull: true }),
    created_at: column("created_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
  },
  {
    score_events_device_boot_sequence_unique: index(
      "score_events_device_boot_sequence_unique",
      ["device_id", "boot_id", "sequence"],
      { isUnique: true },
    ),
    score_events_tenant_id_unique: index("score_events_tenant_id_unique", [
      "tenant_id",
      "id",
    ], { isUnique: true }),
    score_events_tenant_id_idx: index("score_events_tenant_id_idx", ["tenant_id"]),
    score_events_play_session_id_idx: index("score_events_play_session_id_idx", [
      "play_session_id",
    ]),
    score_events_device_id_idx: index("score_events_device_id_idx", ["device_id"]),
  },
  {
    score_events_tenant_id_tenants_id_fk: fk(
      "score_events_tenant_id_tenants_id_fk",
      "score_events",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    score_events_device_id_devices_id_fk: fk(
      "score_events_device_id_devices_id_fk",
      "score_events",
      "devices",
      ["device_id"],
      ["id"],
    ),
    score_events_play_session_id_play_sessions_id_fk: fk(
      "score_events_play_session_id_play_sessions_id_fk",
      "score_events",
      "play_sessions",
      ["play_session_id"],
      ["id"],
    ),
    score_events_assignment_id_device_assignments_id_fk: fk(
      "score_events_assignment_id_device_assignments_id_fk",
      "score_events",
      "device_assignments",
      ["assignment_id"],
      ["id"],
    ),
    score_events_resource_id_resources_id_fk: fk(
      "score_events_resource_id_resources_id_fk",
      "score_events",
      "resources",
      ["resource_id"],
      ["id"],
    ),
    score_events_location_id_locations_id_fk: fk(
      "score_events_location_id_locations_id_fk",
      "score_events",
      "locations",
      ["location_id"],
      ["id"],
    ),
  },
)

const scoreSnapshots = table(
  "score_snapshots",
  {
    id: column("id", "uuid", { primaryKey: true, notNull: true, default: "gen_random_uuid()" }),
    tenant_id: column("tenant_id", "uuid", { notNull: true, default: tenantDefault }),
    play_session_id: column("play_session_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid", { notNull: true }),
    location_id: column("location_id", "uuid", { notNull: true }),
    version: column("version", "integer", { notNull: true, default: "0" }),
    state: column("state", "jsonb", { notNull: true }),
    last_event_id: column("last_event_id", "uuid", { notNull: false }),
    last_sequence: column("last_sequence", "integer", { notNull: false }),
    last_boot_id: column("last_boot_id", "text", { notNull: false }),
    created_at: column("created_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    updated_at: column("updated_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
  },
  {
    score_snapshots_play_session_unique: index(
      "score_snapshots_play_session_unique",
      ["play_session_id"],
      { isUnique: true },
    ),
    score_snapshots_tenant_id_unique: index("score_snapshots_tenant_id_unique", [
      "tenant_id",
      "id",
    ], { isUnique: true }),
    score_snapshots_tenant_id_idx: index("score_snapshots_tenant_id_idx", [
      "tenant_id",
    ]),
    score_snapshots_resource_id_idx: index("score_snapshots_resource_id_idx", [
      "resource_id",
    ]),
  },
  {
    score_snapshots_tenant_id_tenants_id_fk: fk(
      "score_snapshots_tenant_id_tenants_id_fk",
      "score_snapshots",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    score_snapshots_play_session_id_play_sessions_id_fk: fk(
      "score_snapshots_play_session_id_play_sessions_id_fk",
      "score_snapshots",
      "play_sessions",
      ["play_session_id"],
      ["id"],
    ),
    score_snapshots_resource_id_resources_id_fk: fk(
      "score_snapshots_resource_id_resources_id_fk",
      "score_snapshots",
      "resources",
      ["resource_id"],
      ["id"],
    ),
    score_snapshots_location_id_locations_id_fk: fk(
      "score_snapshots_location_id_locations_id_fk",
      "score_snapshots",
      "locations",
      ["location_id"],
      ["id"],
    ),
    score_snapshots_last_event_id_score_events_id_fk: fk(
      "score_snapshots_last_event_id_score_events_id_fk",
      "score_snapshots",
      "score_events",
      ["last_event_id"],
      ["id"],
      "set null",
    ),
  },
)

const snap17 = readJson(join(metaDirectory, "0017_snapshot.json"))
const snap18 = {
  ...snap17,
  id: randomUUID(),
  prevId: snap17.id,
  tables: {
    ...snap17.tables,
    "public.score_events": scoreEvents,
    "public.score_snapshots": scoreSnapshots,
  },
  enums: {
    ...snap17.enums,
    "public.score_event_kind": scoreEventKind,
    "public.score_side": scoreSide,
  },
}

writeJson(join(metaDirectory, "0018_snapshot.json"), snap18)

const migrationPath = join(root, "drizzle", "0018_score_events.sql")
const hash = createHash("sha256").update(readFileSync(migrationPath)).digest("hex")
console.log("0018_score_events sha256:", hash)
console.log("Wrote drizzle/meta/0018_snapshot.json")
