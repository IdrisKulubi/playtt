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
const file = readFileSync(join(root, "db", "seed-phase1.sql"), "utf8");
await sql.unsafe(file);
await sql.end();
console.log("Seed complete: db/seed-phase1.sql");
