export const PHASE5_MIGRATION_FILES = [
  "0022_phase5_access_grants.sql",
  "0023_phase5_ttlock_inventory.sql",
  "0024_phase5_notifications_relays.sql",
]

export const PHASE5_TABLES = [
  "access_grants",
  "ttlock_access_point_locks",
  "ttlock_connections",
  "ttlock_gateways",
  "ttlock_locks",
  "ttlock_unlock_records",
  "ttlock_venue_connections",
  "notification_preferences",
  "push_device_tokens",
  "relay_channels",
]

export const PHASE5_TYPES = [
  "access_grant_status",
  "ttlock_connection_status",
  "ttlock_inventory_status",
  "ttlock_unlock_event_kind",
  "push_device_platform",
  "push_device_status",
  "relay_channel_purpose",
]

export const PHASE5_ENUM_ADDITIONS = [
  { type: "access_credential_status", value: "provisioning", before: "active" },
  { type: "access_credential_status", value: "modifying", before: "expired" },
  { type: "access_credential_status", value: "retrying", before: "expired" },
  { type: "access_credential_status", value: "revoking", before: "expired" },
  { type: "device_assignment_role", value: "relay_controller" },
  { type: "device_command_kind", value: "set_output" },
]

export const ACCESS_CREDENTIAL_COLUMNS = [
  "grant_id",
  "access_point_id",
  "lock_device_id",
  "connection_id",
  "stable_name",
  "attempt_count",
  "max_attempts",
  "next_attempt_at",
  "lease_owner",
  "leased_until",
  "provider_error_category",
  "provider_error_code",
  "provisioned_at",
  "revoke_requested_at",
  "revoked_at",
  "reconciled_at",
]

export const NOTIFICATION_COLUMNS = [
  "deduplication_key",
  "attempt_count",
  "max_attempts",
  "next_attempt_at",
  "lease_owner",
  "leased_until",
  "last_error_code",
]

export const PHASE5_CONSTRAINTS = [
  "access_grants_valid_window",
  "access_grants_tenant_id_tenants_id_fk",
  "access_grants_owner_user_id_user_id_fk",
  "access_grants_tenant_booking_fk",
  "access_grants_tenant_session_fk",
  "access_grants_tenant_location_fk",
  "access_grants_tenant_resource_fk",
  "access_credentials_grant_id_access_grants_id_fk",
  "access_credentials_access_point_id_access_points_id_fk",
  "access_credentials_lock_device_id_devices_id_fk",
  "access_credentials_tenant_grant_fk",
  "access_credentials_tenant_access_point_fk",
  "access_credentials_tenant_lock_device_fk",
  "access_credentials_tenant_connection_fk",
  "access_credentials_attempts_valid",
  "ttlock_connections_access_token_key_pair",
  "ttlock_connections_refresh_token_key_pair",
  "ttlock_locks_battery_range",
  "ttlock_access_point_locks_tenant_point_fk",
  "ttlock_access_point_locks_tenant_lock_fk",
  "ttlock_access_point_locks_tenant_connection_fk",
  "ttlock_connections_tenant_id_tenants_id_fk",
  "ttlock_gateways_tenant_connection_fk",
  "ttlock_gateways_tenant_device_fk",
  "ttlock_locks_tenant_connection_fk",
  "ttlock_locks_tenant_gateway_fk",
  "ttlock_locks_tenant_device_fk",
  "ttlock_unlock_records_tenant_connection_fk",
  "ttlock_unlock_records_tenant_lock_fk",
  "ttlock_unlock_records_tenant_credential_fk",
  "ttlock_venue_connections_tenant_location_fk",
  "ttlock_venue_connections_tenant_connection_fk",
  "push_device_tokens_failure_count_nonnegative",
  "relay_channels_output_nonnegative",
  "notifications_attempts_valid",
]

export const PHASE5_INDEXES = [
  "access_grants_tenant_id_unique",
  "access_grants_active_booking_unique",
  "access_grants_tenant_status_idx",
  "access_grants_booking_idx",
  "access_grants_session_idx",
  "access_grants_valid_until_idx",
  "access_credentials_tenant_id_unique",
  "access_credentials_grant_point_unique",
  "access_credentials_connection_stable_name_unique",
  "access_credentials_connection_external_reference_unique",
  "access_credentials_grant_id_idx",
  "access_credentials_access_point_id_idx",
  "access_credentials_lock_device_id_idx",
  "access_credentials_retry_idx",
  "ttlock_access_point_locks_active_point_unique",
  "ttlock_access_point_locks_active_lock_unique",
  "ttlock_access_point_locks_connection_idx",
  "ttlock_connections_tenant_id_unique",
  "ttlock_connections_tenant_name_unique",
  "ttlock_connections_tenant_status_idx",
  "ttlock_gateways_tenant_id_unique",
  "ttlock_gateways_connection_external_unique",
  "ttlock_gateways_tenant_device_unique",
  "ttlock_gateways_tenant_status_idx",
  "ttlock_locks_tenant_id_unique",
  "ttlock_locks_connection_external_unique",
  "ttlock_locks_tenant_device_unique",
  "ttlock_locks_tenant_status_idx",
  "ttlock_locks_gateway_idx",
  "ttlock_unlock_records_connection_external_unique",
  "ttlock_unlock_records_tenant_occurred_idx",
  "ttlock_unlock_records_lock_occurred_idx",
  "ttlock_venue_connections_location_connection_unique",
  "ttlock_venue_connections_tenant_idx",
  "notification_preferences_user_channel_template_unique",
  "notification_preferences_tenant_user_idx",
  "push_device_tokens_tenant_id_unique",
  "push_device_tokens_installation_unique",
  "push_device_tokens_fingerprint_unique",
  "push_device_tokens_tenant_user_status_idx",
  "relay_channels_tenant_id_unique",
  "relay_channels_device_output_unique",
  "relay_channels_resource_key_unique",
  "relay_channels_location_active_idx",
  "notifications_tenant_deduplication_unique",
  "notifications_delivery_retry_idx",
]

export const SKIPPABLE_PG_CODES = new Set([
  "42710", // duplicate_object
  "42P07", // duplicate_table
  "42701", // duplicate_column
  "42703", // undefined_column (drop missing column)
  "23505", // unique_violation
  "42704", // undefined_object (drop missing index)
  "42P16", // invalid_table_definition (already NOT NULL)
  "42723", // duplicate_function
])

export function parseMigrationStatements(content) {
  return content
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

export function classifyMigrationStatement(statement) {
  if (/^CREATE (UNIQUE )?INDEX/i.test(statement)) return "index"
  if (/ADD CONSTRAINT .* FOREIGN KEY/i.test(statement)) return "fk"
  if (/ADD CONSTRAINT/i.test(statement)) return "check"
  if (/^CREATE TYPE/i.test(statement)) return "type"
  if (/^CREATE TABLE/i.test(statement)) return "table"
  if (/^ALTER TABLE .* ADD COLUMN/i.test(statement)) return "column"
  if (/^ALTER TYPE/i.test(statement)) return "enum"
  if (/^INSERT INTO/i.test(statement)) return "data"
  if (/^UPDATE /i.test(statement)) return "data"
  if (/^DO \$\$/i.test(statement)) return "guard"
  if (/^DROP /i.test(statement)) return "drop"
  if (/^ALTER TABLE .* ALTER COLUMN/i.test(statement)) return "alter"
  return "other"
}

const MIGRATION_STATEMENT_ORDER = [
  "type",
  "enum",
  "table",
  "column",
  "data",
  "guard",
  "alter",
  "index",
  "fk",
  "check",
  "drop",
  "other",
]

export function orderMigrationStatements(statements) {
  return [...statements].sort((left, right) => {
    const leftOrder = MIGRATION_STATEMENT_ORDER.indexOf(
      classifyMigrationStatement(left),
    )
    const rightOrder = MIGRATION_STATEMENT_ORDER.indexOf(
      classifyMigrationStatement(right),
    )
    return leftOrder - rightOrder
  })
}

export function shouldSkipMigrationStatement(statement) {
  if (statement.includes("Phase 5 migration cannot map")) {
    return "guard"
  }
  return null
}
