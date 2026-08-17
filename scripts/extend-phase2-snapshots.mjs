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

function fk(name, tableFrom, tableTo, columnsFrom, columnsTo) {
  return {
    name,
    tableFrom,
    tableTo,
    columnsFrom,
    columnsTo,
    onDelete: "restrict",
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

const accessPoints = table(
  "access_points",
  {
    id: column("id", "uuid", { primaryKey: true, notNull: true }),
    tenant_id: column("tenant_id", "uuid", { notNull: true }),
    location_id: column("location_id", "uuid", { notNull: true }),
    zone_id: column("zone_id", "uuid"),
    code: column("code", "text", { notNull: true }),
    name: column("name", "text", { notNull: true }),
    kind: column("kind", "access_point_kind", {
      notNull: true,
      typeSchema: "public",
    }),
    sort_order: column("sort_order", "integer", { notNull: true, default: 0 }),
    is_active: column("is_active", "boolean", { notNull: true, default: true }),
    ...timestamps,
  },
  {
    access_points_tenant_location_code_unique: index(
      "access_points_tenant_location_code_unique",
      ["tenant_id", "location_id", "code"],
      { isUnique: true },
    ),
    access_points_tenant_id_unique: index(
      "access_points_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    access_points_tenant_id_idx: index("access_points_tenant_id_idx", [
      "tenant_id",
    ]),
    access_points_location_id_idx: index("access_points_location_id_idx", [
      "location_id",
    ]),
    access_points_zone_id_idx: index("access_points_zone_id_idx", ["zone_id"]),
  },
  {
    access_points_tenant_id_tenants_id_fk: fk(
      "access_points_tenant_id_tenants_id_fk",
      "access_points",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    access_points_location_id_locations_id_fk: fk(
      "access_points_location_id_locations_id_fk",
      "access_points",
      "locations",
      ["location_id"],
      ["id"],
    ),
    access_points_zone_id_zones_id_fk: fk(
      "access_points_zone_id_zones_id_fk",
      "access_points",
      "zones",
      ["zone_id"],
      ["id"],
    ),
  },
)

const accessPointResources = table(
  "access_point_resources",
  {
    id: column("id", "uuid", {
      primaryKey: true,
      notNull: true,
      default: "gen_random_uuid()",
    }),
    tenant_id: column("tenant_id", "uuid", { notNull: true }),
    access_point_id: column("access_point_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid", { notNull: true }),
    sort_order: column("sort_order", "integer", { notNull: true, default: 0 }),
    ...timestamps,
  },
  {
    access_point_resources_point_resource_unique: index(
      "access_point_resources_point_resource_unique",
      ["access_point_id", "resource_id"],
      { isUnique: true },
    ),
    access_point_resources_tenant_id_unique: index(
      "access_point_resources_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    access_point_resources_tenant_id_idx: index(
      "access_point_resources_tenant_id_idx",
      ["tenant_id"],
    ),
    access_point_resources_access_point_id_idx: index(
      "access_point_resources_access_point_id_idx",
      ["access_point_id"],
    ),
    access_point_resources_resource_id_idx: index(
      "access_point_resources_resource_id_idx",
      ["resource_id"],
    ),
  },
  {
    access_point_resources_tenant_id_tenants_id_fk: fk(
      "access_point_resources_tenant_id_tenants_id_fk",
      "access_point_resources",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    access_point_resources_access_point_id_access_points_id_fk: fk(
      "access_point_resources_access_point_id_access_points_id_fk",
      "access_point_resources",
      "access_points",
      ["access_point_id"],
      ["id"],
    ),
    access_point_resources_resource_id_resources_id_fk: fk(
      "access_point_resources_resource_id_resources_id_fk",
      "access_point_resources",
      "resources",
      ["resource_id"],
      ["id"],
    ),
  },
)

const paymentWebhookInbox = table(
  "payment_webhook_inbox",
  {
    id: column("id", "uuid", {
      primaryKey: true,
      notNull: true,
      default: "gen_random_uuid()",
    }),
    tenant_id: column("tenant_id", "uuid"),
    provider: column("provider", "payment_provider", {
      notNull: true,
      default: "'paystack'",
      typeSchema: "public",
    }),
    provider_event_id: column("provider_event_id", "text"),
    payload_hash: column("payload_hash", "text", { notNull: true }),
    signature: column("signature", "text", { notNull: true }),
    event_type: column("event_type", "text", { notNull: true }),
    raw_payload: column("raw_payload", "text", { notNull: true }),
    status: column("status", "payment_webhook_inbox_status", {
      notNull: true,
      default: "'received'",
      typeSchema: "public",
    }),
    attempts: column("attempts", "integer", { notNull: true, default: 0 }),
    last_error: column("last_error", "text"),
    received_at: column("received_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    processed_at: column("processed_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    payment_webhook_inbox_provider_payload_hash_unique: index(
      "payment_webhook_inbox_provider_payload_hash_unique",
      ["provider", "payload_hash"],
      { isUnique: true },
    ),
    payment_webhook_inbox_provider_event_unique: index(
      "payment_webhook_inbox_provider_event_unique",
      ["provider", "provider_event_id"],
      {
        isUnique: true,
        where: '"payment_webhook_inbox"."provider_event_id" is not null',
      },
    ),
    payment_webhook_inbox_status_received_idx: index(
      "payment_webhook_inbox_status_received_idx",
      ["status", "received_at"],
    ),
    payment_webhook_inbox_provider_event_idx: index(
      "payment_webhook_inbox_provider_event_idx",
      ["provider", "provider_event_id"],
    ),
  },
  {
    payment_webhook_inbox_tenant_id_tenants_id_fk: fk(
      "payment_webhook_inbox_tenant_id_tenants_id_fk",
      "payment_webhook_inbox",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
  },
)

const outboxEvents = table(
  "outbox_events",
  {
    id: column("id", "uuid", {
      primaryKey: true,
      notNull: true,
      default: "gen_random_uuid()",
    }),
    tenant_id: column("tenant_id", "uuid"),
    venue_id: column("venue_id", "uuid"),
    resource_id: column("resource_id", "uuid"),
    session_id: column("session_id", "uuid"),
    aggregate_type: column("aggregate_type", "text", { notNull: true }),
    aggregate_id: column("aggregate_id", "text", { notNull: true }),
    event_type: column("event_type", "text", { notNull: true }),
    event_version: column("event_version", "integer", {
      notNull: true,
      default: 1,
    }),
    correlation_id: column("correlation_id", "text", { notNull: true }),
    causation_id: column("causation_id", "text"),
    payload: column("payload", "jsonb", { notNull: true }),
    idempotency_key: column("idempotency_key", "text", { notNull: true }),
    status: column("status", "outbox_event_status", {
      notNull: true,
      default: "'pending'",
      typeSchema: "public",
    }),
    available_at: column("available_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    lease_expires_at: column("lease_expires_at", "timestamp with time zone"),
    lease_owner: column("lease_owner", "text"),
    attempts: column("attempts", "integer", { notNull: true, default: 0 }),
    last_error: column("last_error", "text"),
    processed_at: column("processed_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    outbox_events_idempotency_unique: index(
      "outbox_events_idempotency_unique",
      ["idempotency_key"],
      { isUnique: true },
    ),
    outbox_events_claim_idx: index("outbox_events_claim_idx", [
      "status",
      "available_at",
    ]),
    outbox_events_tenant_id_idx: index("outbox_events_tenant_id_idx", [
      "tenant_id",
    ]),
    outbox_events_event_type_idx: index("outbox_events_event_type_idx", [
      "event_type",
      "event_version",
    ]),
  },
  {
    outbox_events_tenant_id_tenants_id_fk: fk(
      "outbox_events_tenant_id_tenants_id_fk",
      "outbox_events",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    outbox_events_venue_id_locations_id_fk: fk(
      "outbox_events_venue_id_locations_id_fk",
      "outbox_events",
      "locations",
      ["venue_id"],
      ["id"],
    ),
    outbox_events_resource_id_resources_id_fk: fk(
      "outbox_events_resource_id_resources_id_fk",
      "outbox_events",
      "resources",
      ["resource_id"],
      ["id"],
    ),
  },
)

function cloneSnapshot(previous, extras) {
  const next = structuredClone(previous)
  next.id = randomUUID()
  next.prevId = previous.id
  Object.assign(next.tables, extras.tables ?? {})
  Object.assign(next.enums, extras.enums ?? {})
  return next
}

const snap10 = readJson(join(metaDirectory, "0010_snapshot.json"))

const snap11 = cloneSnapshot(snap10, {
  tables: {
    "public.access_points": accessPoints,
    "public.access_point_resources": accessPointResources,
  },
  enums: {
    "public.access_point_kind": {
      name: "access_point_kind",
      schema: "public",
      values: ["entrance", "hall", "resource"],
    },
  },
})

const snap12 = cloneSnapshot(snap11, {
  tables: {
    "public.payment_webhook_inbox": paymentWebhookInbox,
  },
  enums: {
    "public.payment_webhook_inbox_status": {
      name: "payment_webhook_inbox_status",
      schema: "public",
      values: ["received", "processing", "processed", "failed", "dead_letter"],
    },
  },
})

const inboxWithLease = structuredClone(paymentWebhookInbox)
inboxWithLease.columns.available_at = column(
  "available_at",
  "timestamp with time zone",
  { notNull: true, default: "now()" },
)
inboxWithLease.columns.lease_expires_at = column(
  "lease_expires_at",
  "timestamp with time zone",
)
inboxWithLease.columns.lease_owner = column("lease_owner", "text")
inboxWithLease.indexes.payment_webhook_inbox_claim_idx = index(
  "payment_webhook_inbox_claim_idx",
  ["status", "available_at"],
)

const snap13 = cloneSnapshot(snap12, {
  tables: {
    "public.payment_webhook_inbox": inboxWithLease,
    "public.outbox_events": outboxEvents,
  },
  enums: {
    "public.outbox_event_status": {
      name: "outbox_event_status",
      schema: "public",
      values: ["pending", "processing", "processed", "dead_letter"],
    },
  },
})

const playSessions = table(
  "play_sessions",
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
    booking_id: column("booking_id", "uuid", { notNull: true }),
    location_id: column("location_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid", { notNull: true }),
    status: column("status", "play_session_status", {
      notNull: true,
      default: "'confirmed'",
      typeSchema: "public",
    }),
    correlation_id: column("correlation_id", "text", { notNull: true }),
    scheduled_start_at: column("scheduled_start_at", "timestamp with time zone", {
      notNull: true,
    }),
    scheduled_end_at: column("scheduled_end_at", "timestamp with time zone", {
      notNull: true,
    }),
    prepared_at: column("prepared_at", "timestamp with time zone"),
    started_at: column("started_at", "timestamp with time zone"),
    ended_at: column("ended_at", "timestamp with time zone"),
    completed_at: column("completed_at", "timestamp with time zone"),
    reset_at: column("reset_at", "timestamp with time zone"),
    configuration_snapshot: column("configuration_snapshot", "jsonb", {
      notNull: true,
    }),
    configuration_version: column("configuration_version", "integer", {
      notNull: true,
      default: 1,
    }),
    ...timestamps,
  },
  {
    play_sessions_booking_id_unique: index(
      "play_sessions_booking_id_unique",
      ["booking_id"],
      { isUnique: true },
    ),
    play_sessions_tenant_id_unique: index(
      "play_sessions_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    play_sessions_tenant_booking_unique: index(
      "play_sessions_tenant_booking_unique",
      ["tenant_id", "booking_id"],
      { isUnique: true },
    ),
    play_sessions_tenant_id_idx: index("play_sessions_tenant_id_idx", [
      "tenant_id",
    ]),
    play_sessions_status_idx: index("play_sessions_status_idx", [
      "status",
      "scheduled_start_at",
    ]),
  },
  {
    play_sessions_tenant_id_tenants_id_fk: fk(
      "play_sessions_tenant_id_tenants_id_fk",
      "play_sessions",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    play_sessions_booking_id_bookings_id_fk: fk(
      "play_sessions_booking_id_bookings_id_fk",
      "play_sessions",
      "bookings",
      ["booking_id"],
      ["id"],
    ),
    play_sessions_location_id_locations_id_fk: fk(
      "play_sessions_location_id_locations_id_fk",
      "play_sessions",
      "locations",
      ["location_id"],
      ["id"],
    ),
    play_sessions_resource_id_resources_id_fk: fk(
      "play_sessions_resource_id_resources_id_fk",
      "play_sessions",
      "resources",
      ["resource_id"],
      ["id"],
    ),
  },
)

const sessionParticipants = table(
  "session_participants",
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
    play_session_id: column("play_session_id", "uuid", { notNull: true }),
    user_id: column("user_id", "text", { notNull: true }),
    role: column("role", "session_participant_role", {
      notNull: true,
      default: "'owner'",
      typeSchema: "public",
    }),
    created_at: column("created_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
  },
  {
    session_participants_session_user_unique: index(
      "session_participants_session_user_unique",
      ["play_session_id", "user_id"],
      { isUnique: true },
    ),
    session_participants_tenant_id_unique: index(
      "session_participants_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    session_participants_tenant_id_idx: index(
      "session_participants_tenant_id_idx",
      ["tenant_id"],
    ),
    session_participants_play_session_id_idx: index(
      "session_participants_play_session_id_idx",
      ["play_session_id"],
    ),
  },
  {
    session_participants_tenant_id_tenants_id_fk: fk(
      "session_participants_tenant_id_tenants_id_fk",
      "session_participants",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    session_participants_play_session_id_play_sessions_id_fk: fk(
      "session_participants_play_session_id_play_sessions_id_fk",
      "session_participants",
      "play_sessions",
      ["play_session_id"],
      ["id"],
    ),
    session_participants_user_id_user_id_fk: fk(
      "session_participants_user_id_user_id_fk",
      "session_participants",
      "user",
      ["user_id"],
      ["id"],
    ),
  },
)

const snap14 = cloneSnapshot(snap13, {
  tables: {
    "public.play_sessions": playSessions,
    "public.session_participants": sessionParticipants,
  },
  enums: {
    "public.play_session_status": {
      name: "play_session_status",
      schema: "public",
      values: [
        "held",
        "confirmed",
        "preparing",
        "active",
        "ending",
        "completed",
        "resetting",
        "available",
      ],
    },
    "public.session_participant_role": {
      name: "session_participant_role",
      schema: "public",
      values: ["owner", "guest"],
    },
  },
})

writeJson(join(metaDirectory, "0011_snapshot.json"), snap11)
writeJson(join(metaDirectory, "0012_snapshot.json"), snap12)
writeJson(join(metaDirectory, "0013_snapshot.json"), snap13)
writeJson(join(metaDirectory, "0014_snapshot.json"), snap14)

console.log("Wrote drizzle/meta/0011_snapshot.json through 0014_snapshot.json")
