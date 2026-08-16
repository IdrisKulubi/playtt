# Disposable PostgreSQL integration tests

These tests exercise PostgreSQL concurrency with a uniquely named, isolated
schema. The harness never loads `.env.local` and refuses to connect unless both
test-only environment variables are explicitly supplied.

## Safety contract

Set these variables in the shell that launches the test:

```text
PLAYTT_TEST_DATABASE_URL=postgresql://.../a_disposable_test_database
PLAYTT_TEST_DATABASE_CONFIRM=CREATE_AND_DROP_ISOLATED_PLAYTT_TEST_SCHEMA
```

The harness:

- refuses a missing or invalid `PLAYTT_TEST_DATABASE_URL`;
- refuses a missing or incorrect confirmation sentinel;
- refuses when the test URL targets the same host, port, and database name as
  `POSTGRES_URL`, even if credentials or query parameters differ;
- creates a random `playtt_test_<time>_<pid>_<entropy>` schema;
- uses only schema-qualified test tables;
- seeds only per-test synthetic fixtures;
- validates the generated schema name again immediately before teardown; and
- drops only that exact schema with `DROP SCHEMA ... CASCADE`, then closes the
  test connection.

Run the offline guard tests without any database variables:

```bash
node --test scripts/disposable-postgres.test.mjs
```

Run the PostgreSQL scenarios only against an intentionally disposable database:

```bash
node --test --test-concurrency=1 scripts/integration/phase0-concurrency.test.mjs
```

Node 22.18 or newer is the supported baseline for the repository's
dependency-free Node test commands.

## Deliberate migration limitation

The current migrations cannot be replayed safely into an isolated schema:
`0000` and later migrations create enums and foreign keys against hard-coded
`public` objects. Changing only `search_path` would still mutate or reference the
application schema.

The harness therefore installs the minimum exact DDL needed to test:

1. PostgreSQL half-open range exclusion behavior for overlapping/adjacent holds;
2. conditional expected-state booking claims plus history insertion; and
3. modification-row and credit-balance row locks with a conditional claim;
4. replay-pack payment claims, credit-ledger recovery, and duplicate-safe balance updates; and
5. Coach payment claims, missing-subscription recovery, and subscription-period preservation.

The test exclusion constraint intentionally covers the single synthetic
resource without `btree_gist`; installing that extension is database-wide and
would violate schema isolation. Production's resource-scoped custom constraint
remains protected separately by `db:validate`.

These are PostgreSQL concurrency-semantics tests, not a full migration replay.
A future full-migration gate must create and destroy an entire disposable
database (or disposable Neon branch), then apply the real Drizzle lineage after
the migration metadata is repaired.
