import postgres from "postgres"

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) throw new Error("POSTGRES_URL required")
  return url
}

const sql = postgres(getDatabaseUrl(), { max: 1 })
try {
  const rows = await sql`select * from drizzle.__drizzle_migrations order by created_at`
  console.log(JSON.stringify(rows, null, 2))
  const cols = await sql`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='tenant_id'
  `
  console.log("bookings.tenant_id:", cols[0])
  const composite = await sql`
    select conname from pg_constraint
    where conname in (
      'bookings_tenant_location_fk',
      'bookings_tenant_resource_fk',
      'payments_tenant_booking_fk'
    )
  `
  console.log("composite fks:", composite)
} finally {
  await sql.end({ timeout: 5 })
}
