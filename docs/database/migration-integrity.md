# Migration integrity safety net

The migration validator is repository-only. It reads files under `drizzle/` and
never imports the database client, reads `POSTGRES_URL`, or connects to Neon.

## Commands

```bash
pnpm db:validate
pnpm db:validate:strict
pnpm test:db
```

- `db:validate` verifies SQL digests, journal/snapshot relationships, and the
  required custom PostgreSQL constraints. It permits only the exact metadata
  drift recorded in `drizzle/migration-integrity.json`; new or stale findings
  fail the command.
- `db:validate:strict` fails while any metadata drift exists. Keep this command
  red until the migration ledger has been fingerprinted in every environment
  and repaired safely.
- `test:db` exercises the validator with temporary filesystem fixtures. It does
  not require dependencies or a database.

If the package-manager wrapper cannot run without reinstalling dependencies,
the scripts can be invoked directly because they use only Node built-ins:

```bash
node scripts/validate-migrations.mjs
node scripts/validate-migrations.mjs --strict
node --test scripts/validate-migrations.test.mjs
```

## Known metadata drift

The repository currently proves only these facts:

- the journal contains `0000` and `0001`;
- only `0000_snapshot.json` exists;
- SQL files `0002`, `0003`, and `0004` exist outside the journal;
- the migration SQL digests match the recorded integrity baseline;
- the booking exclusion constraint and two partial unique indexes remain in
  `0000_curvy_hiroim.sql`.

This does **not** prove which migrations were applied to any deployed database.
Do not add journal entries, fabricate snapshots, or mark migrations as applied
until every environment has a reviewed schema and migration-ledger fingerprint.

## Metadata repair gate

Before changing Drizzle metadata:

1. Capture a schema-only database fingerprint and the Drizzle migration ledger
   from every environment.
2. Classify each environment as missing, exactly matching, or partially matching
   migrations `0002` through `0004`.
3. Rehearse the repair on a disposable Neon branch or PostgreSQL database with
   the same fingerprint.
4. Verify an empty database and each existing shape converge to the same schema.
5. Update the journal, sequential snapshots, and integrity baseline together.
6. Require `db:validate:strict` and the database integration suite to pass.
