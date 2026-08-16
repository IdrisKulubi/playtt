import { createHash } from "node:crypto"

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const keys = Object.keys(value).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`
}

export function fingerprintValue(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

const FINGERPRINT_QUERIES = {
  extensions: `
    select extname as name
    from pg_extension
    where extname in ('btree_gist')
    order by extname
  `,
  enums: `
    select
      n.nspname as schema,
      t.typname as name,
      array_agg(e.enumlabel order by e.enumsortorder) as values
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
    group by n.nspname, t.typname
    order by n.nspname, t.typname
  `,
  tables: `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `,
  columns: `
    select
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `,
  indexes: `
    select
      tablename,
      indexname,
      indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `,
  constraints: `
    select
      conrelid::regclass::text as table_name,
      conname as name,
      pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
    order by conrelid::regclass::text, conname
  `,
}

export async function collectSchemaFingerprint(sql) {
  const sections = {}

  for (const [key, query] of Object.entries(FINGERPRINT_QUERIES)) {
    sections[key] = await sql.unsafe(query)
  }

  return {
    sections,
    digest: fingerprintValue(sections),
  }
}
