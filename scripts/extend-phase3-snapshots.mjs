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

function cloneSnapshot(base, patch) {
  return {
    ...base,
    ...patch,
    tables: { ...base.tables, ...patch.tables },
    enums: { ...base.enums, ...patch.enums },
  }
}

const snap14 = readJson(join(metaDirectory, "0014_snapshot.json"))

const devices = table(
  "devices",
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
    type: column("type", "device_type", {
      notNull: true,
      typeSchema: "public",
    }),
    hardware_uid: column("hardware_uid", "text", { notNull: true }),
    firmware_version: column("firmware_version", "text"),
    status: column("status", "device_status", {
      notNull: true,
      default: "'pending'",
      typeSchema: "public",
    }),
    capability_codes: column("capability_codes", "jsonb", {
      notNull: true,
      default: "'[]'::jsonb",
    }),
    last_seen_at: column("last_seen_at", "timestamp with time zone"),
    last_heartbeat_at: column("last_heartbeat_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    devices_tenant_id_unique: index("devices_tenant_id_unique", [
      "tenant_id",
      "id",
    ], { isUnique: true }),
    devices_tenant_hardware_uid_unique: index(
      "devices_tenant_hardware_uid_unique",
      ["tenant_id", "hardware_uid"],
      { isUnique: true },
    ),
    devices_tenant_id_idx: index("devices_tenant_id_idx", ["tenant_id"]),
    devices_location_id_idx: index("devices_location_id_idx", ["location_id"]),
    devices_status_idx: index("devices_status_idx", ["status"]),
  },
  {
    devices_tenant_id_tenants_id_fk: fk(
      "devices_tenant_id_tenants_id_fk",
      "devices",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    devices_location_id_locations_id_fk: fk(
      "devices_location_id_locations_id_fk",
      "devices",
      "locations",
      ["location_id"],
      ["id"],
    ),
  },
)

const deviceEnrollments = table(
  "device_enrollments",
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
    device_type: column("device_type", "device_type", {
      notNull: true,
      typeSchema: "public",
    }),
    code_hash: column("code_hash", "text", { notNull: true }),
    expires_at: column("expires_at", "timestamp with time zone", {
      notNull: true,
    }),
    consumed_at: column("consumed_at", "timestamp with time zone"),
    consumed_device_id: column("consumed_device_id", "uuid"),
    correlation_id: column("correlation_id", "text", { notNull: true }),
    created_at: column("created_at", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
  },
  {
    device_enrollments_tenant_code_hash_unique: index(
      "device_enrollments_tenant_code_hash_unique",
      ["tenant_id", "code_hash"],
      { isUnique: true },
    ),
    device_enrollments_tenant_id_idx: index(
      "device_enrollments_tenant_id_idx",
      ["tenant_id"],
    ),
    device_enrollments_location_id_idx: index(
      "device_enrollments_location_id_idx",
      ["location_id"],
    ),
    device_enrollments_expires_at_idx: index(
      "device_enrollments_expires_at_idx",
      ["expires_at"],
    ),
  },
  {
    device_enrollments_tenant_id_tenants_id_fk: fk(
      "device_enrollments_tenant_id_tenants_id_fk",
      "device_enrollments",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    device_enrollments_location_id_locations_id_fk: fk(
      "device_enrollments_location_id_locations_id_fk",
      "device_enrollments",
      "locations",
      ["location_id"],
      ["id"],
    ),
    device_enrollments_consumed_device_id_devices_id_fk: fk(
      "device_enrollments_consumed_device_id_devices_id_fk",
      "device_enrollments",
      "devices",
      ["consumed_device_id"],
      ["id"],
    ),
  },
)

const deviceCredentials = table(
  "device_credentials",
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
    device_id: column("device_id", "uuid", { notNull: true }),
    version: column("version", "integer", { notNull: true }),
    secret_hash: column("secret_hash", "text", { notNull: true }),
    status: column("status", "device_credential_status", {
      notNull: true,
      default: "'active'",
      typeSchema: "public",
    }),
    rotated_at: column("rotated_at", "timestamp with time zone"),
    revoked_at: column("revoked_at", "timestamp with time zone"),
    ...timestamps,
  },
  {
    device_credentials_device_version_unique: index(
      "device_credentials_device_version_unique",
      ["device_id", "version"],
      { isUnique: true },
    ),
    device_credentials_active_unique: index(
      "device_credentials_active_unique",
      ["device_id"],
      {
        isUnique: true,
        where: "\"status\" = 'active'",
      },
    ),
    device_credentials_tenant_id_unique: index(
      "device_credentials_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    device_credentials_tenant_id_idx: index(
      "device_credentials_tenant_id_idx",
      ["tenant_id"],
    ),
    device_credentials_device_id_idx: index(
      "device_credentials_device_id_idx",
      ["device_id"],
    ),
  },
  {
    device_credentials_tenant_id_tenants_id_fk: fk(
      "device_credentials_tenant_id_tenants_id_fk",
      "device_credentials",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    device_credentials_device_id_devices_id_fk: fk(
      "device_credentials_device_id_devices_id_fk",
      "device_credentials",
      "devices",
      ["device_id"],
      ["id"],
    ),
  },
)

const deviceAssignments = table(
  "device_assignments",
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
    device_id: column("device_id", "uuid", { notNull: true }),
    location_id: column("location_id", "uuid", { notNull: true }),
    resource_id: column("resource_id", "uuid"),
    role: column("role", "device_assignment_role", {
      notNull: true,
      typeSchema: "public",
    }),
    effective_from: column("effective_from", "timestamp with time zone", {
      notNull: true,
    }),
    effective_to: column("effective_to", "timestamp with time zone"),
    config: column("config", "jsonb", {
      notNull: true,
      default: "'{}'::jsonb",
    }),
    config_version: column("config_version", "integer", {
      notNull: true,
      default: 1,
    }),
    applied_config_version: column("applied_config_version", "integer"),
    ...timestamps,
  },
  {
    device_assignments_device_open_unique: index(
      "device_assignments_device_open_unique",
      ["tenant_id", "device_id"],
      {
        isUnique: true,
        where: "\"effective_to\" is null",
      },
    ),
    device_assignments_scoring_resource_role_open_unique: index(
      "device_assignments_scoring_resource_role_open_unique",
      ["tenant_id", "resource_id", "role"],
      {
        isUnique: true,
        where:
          "\"role\" = 'score_input' and \"resource_id\" is not null and \"effective_to\" is null",
      },
    ),
    device_assignments_tenant_id_unique: index(
      "device_assignments_tenant_id_unique",
      ["tenant_id", "id"],
      { isUnique: true },
    ),
    device_assignments_tenant_id_idx: index(
      "device_assignments_tenant_id_idx",
      ["tenant_id"],
    ),
    device_assignments_device_id_idx: index(
      "device_assignments_device_id_idx",
      ["device_id"],
    ),
    device_assignments_resource_id_idx: index(
      "device_assignments_resource_id_idx",
      ["resource_id"],
    ),
    device_assignments_effective_window_idx: index(
      "device_assignments_effective_window_idx",
      ["device_id", "effective_from", "effective_to"],
    ),
  },
  {
    device_assignments_tenant_id_tenants_id_fk: fk(
      "device_assignments_tenant_id_tenants_id_fk",
      "device_assignments",
      "tenants",
      ["tenant_id"],
      ["id"],
    ),
    device_assignments_device_id_devices_id_fk: fk(
      "device_assignments_device_id_devices_id_fk",
      "device_assignments",
      "devices",
      ["device_id"],
      ["id"],
    ),
    device_assignments_location_id_locations_id_fk: fk(
      "device_assignments_location_id_locations_id_fk",
      "device_assignments",
      "locations",
      ["location_id"],
      ["id"],
    ),
    device_assignments_resource_id_resources_id_fk: fk(
      "device_assignments_resource_id_resources_id_fk",
      "device_assignments",
      "resources",
      ["resource_id"],
      ["id"],
    ),
  },
)

const snap15 = cloneSnapshot(snap14, {
  tables: {
    "public.devices": devices,
    "public.device_enrollments": deviceEnrollments,
    "public.device_credentials": deviceCredentials,
    "public.device_assignments": deviceAssignments,
  },
  enums: {
    "public.device_type": {
      name: "device_type",
      schema: "public",
      values: ["esp32_controller", "ttlock_lock", "ttlock_gateway"],
    },
    "public.device_status": {
      name: "device_status",
      schema: "public",
      values: ["pending", "active", "revoked"],
    },
    "public.device_credential_status": {
      name: "device_credential_status",
      schema: "public",
      values: ["active", "rotated", "revoked"],
    },
    "public.device_assignment_role": {
      name: "device_assignment_role",
      schema: "public",
      values: ["score_input", "lock", "gateway", "display"],
    },
  },
})

snap15.id = randomUUID()
snap15.prevId = snap14.id

writeJson(join(metaDirectory, "0015_snapshot.json"), snap15)

console.log("Wrote drizzle/meta/0015_snapshot.json")
