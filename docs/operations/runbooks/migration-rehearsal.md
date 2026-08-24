# Migration rehearsal

Use before promoting schema changes to production.

## Check

1. Confirm the migration files are committed and `pnpm db:validate:strict` passes locally.
2. Capture the current production schema fingerprint if available.

## Rehearse

1. Create a disposable database with `scripts/lib/disposable-postgres.mjs` or a Neon branch.
2. Replay migrations from empty with `pnpm db:replay-lineage`.
3. Replay migrations from a current clone with `pnpm test:db:integration`.
4. Compare fingerprints; they must match the approved baseline.

## Promote

1. Apply migrations to staging, then production, using the direct migration URL where required.
2. Monitor **Admin → Health** database probe and worker backlog during rollout.

## Verify

- Empty and current-clone replays produce identical fingerprints.
- `pnpm test:db:integration` passes in CI.
- No booking or payment regressions in smoke suites after production rollout.
