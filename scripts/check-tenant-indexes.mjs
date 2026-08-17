import postgres from "postgres"

const sql = postgres(process.env.POSTGRES_URL.replace(/^['"]+|['"]+$/g, "").trim(), { max: 1 })
try {
  const idx = await sql`
    select indexname, indexdef
    from pg_indexes
    where schemaname='public'
      and tablename in ('locations','resources','bookings')
      and indexname like '%tenant%'
    order by indexname
  `
  console.log(idx)
} finally {
  await sql.end({ timeout: 5 })
}
