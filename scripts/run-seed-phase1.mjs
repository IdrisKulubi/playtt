import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/run-seed-phase1.mjs");
  process.exit(1);
}
url = url.replace(/^['"]+|['"]+$/g, "").trim();

const sql = postgres(url, { max: 1 });
const seedFile = readFileSync(join(root, "db", "seed-phase1.sql"), "utf8");
const backfillFile = readFileSync(join(root, "db", "backfill-tenant-scope.sql"), "utf8");
await sql.unsafe(seedFile);
await sql.unsafe(backfillFile);

const adminEmail = process.env.PLAYTT_ADMIN_EMAIL?.trim();
if (adminEmail) {
  await sql`
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
  `;
  console.log(`Promoted ${adminEmail} to PlayTT owner membership.`);
}

await sql.end();
console.log("Seed complete: db/seed-phase1.sql + db/backfill-tenant-scope.sql");
