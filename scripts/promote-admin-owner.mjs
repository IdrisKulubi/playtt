import postgres from "postgres";

let url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set.");
  process.exit(1);
}
url = url.replace(/^['"]+|['"]+$/g, "").trim();

const adminEmail = process.env.PLAYTT_ADMIN_EMAIL?.trim();
if (!adminEmail) {
  console.error("PLAYTT_ADMIN_EMAIL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const updated = await sql`
    insert into tenant_memberships (
      tenant_id,
      user_id,
      role,
      status
    )
    select
      '33333333-3333-3333-3333-333333333333',
      u.id,
      'owner',
      'active'
    from "user" u
    where lower(u.email) = lower(${adminEmail})
    on conflict (tenant_id, user_id) do update
    set
      role = 'owner',
      status = 'active',
      updated_at = now()
    returning user_id
  `;

  if (updated.length === 0) {
    console.error(`No user found with email ${adminEmail}. Sign up first, then rerun.`);
    process.exit(1);
  }

  console.log(`Promoted ${adminEmail} to PlayTT owner (Super Admin). Sign out and back in.`);
} finally {
  await sql.end();
}
