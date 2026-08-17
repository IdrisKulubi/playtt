export const PLAYTT_TENANT_ID = "33333333-3333-3333-3333-333333333333"

export const TENANT_SCOPED_TABLES = [
  "locations",
  "resources",
  "bookings",
  "booking_modifications",
  "booking_status_history",
  "payments",
  "access_credentials",
  "session_events",
  "matches",
  "replays",
  "notifications",
  "hardware_configs",
  "booking_credit_ledger",
  "booking_credit_balances",
  "replay_credit_ledger",
  "replay_credit_balances",
  "product_payments",
  "coach_subscriptions",
  "coach_insights",
  "coach_training_items",
]

export const TENANT_MISMATCH_CHECKS = [
  {
    name: "locations_brand_tenant",
    sql: `select count(*)::int as count from locations l inner join brands b on l.brand_id = b.id where l.tenant_id is distinct from b.tenant_id`,
  },
  {
    name: "zones_location_tenant",
    sql: `select count(*)::int as count from zones z inner join locations l on z.location_id = l.id where z.tenant_id is distinct from l.tenant_id`,
  },
  {
    name: "resources_location_tenant",
    sql: `select count(*)::int as count from resources r inner join locations l on r.location_id = l.id where r.tenant_id is distinct from l.tenant_id`,
  },
  {
    name: "resources_zone_tenant",
    sql: `select count(*)::int as count from resources r inner join zones z on r.zone_id = z.id where r.tenant_id is distinct from z.tenant_id`,
  },
  {
    name: "resources_resource_type_tenant",
    sql: `select count(*)::int as count from resources r inner join resource_types rt on r.resource_type_id = rt.id where r.tenant_id is distinct from rt.tenant_id`,
  },
  {
    name: "resource_capabilities_resource_tenant",
    sql: `select count(*)::int as count from resource_capabilities rc inner join resources r on rc.resource_id = r.id where rc.tenant_id is distinct from r.tenant_id`,
  },
  {
    name: "bookings_location_tenant",
    sql: `
      select count(*)::int as count
      from bookings b
      inner join locations l on b.location_id = l.id
      where b.tenant_id is distinct from l.tenant_id
    `,
  },
  {
    name: "bookings_resource_tenant",
    sql: `
      select count(*)::int as count
      from bookings b
      inner join resources r on b.resource_id = r.id
      where b.tenant_id is distinct from r.tenant_id
    `,
  },
  {
    name: "payments_booking_tenant",
    sql: `
      select count(*)::int as count
      from payments p
      inner join bookings b on p.booking_id = b.id
      where p.tenant_id is distinct from b.tenant_id
    `,
  },
  {
    name: "booking_modifications_booking_tenant",
    sql: `
      select count(*)::int as count
      from booking_modifications bm
      inner join bookings b on bm.booking_id = b.id
      where bm.tenant_id is distinct from b.tenant_id
    `,
  },
  {
    name: "hardware_configs_location_tenant",
    sql: `
      select count(*)::int as count
      from hardware_configs hc
      inner join locations l on hc.location_id = l.id
      where hc.tenant_id is distinct from l.tenant_id
    `,
  },
]

export function buildNullTenantCountQuery(tableName) {
  return `select count(*)::int as count from ${tableName} where tenant_id is null`
}

export function buildOrphanTenantCountQuery(tableName) {
  return `
    select count(*)::int as count
    from ${tableName} t
    left join tenants tn on t.tenant_id = tn.id
    where t.tenant_id is not null and tn.id is null
  `
}
