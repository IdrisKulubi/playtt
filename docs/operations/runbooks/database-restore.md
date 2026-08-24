# Database backup and restore

Use when production data must be recovered from backup or a Neon branch.

## Check

1. Confirm the incident scope in **Admin → Health** and booking timelines.
2. Identify the last known-good timestamp.
3. Open the Neon dashboard for the affected project.

## Restore

1. Create a new Neon branch from the target point-in-time.
2. Update `POSTGRES_URL` in the isolated recovery environment only.
3. Run `pnpm db:migrate` against the restored branch.
4. Run `pnpm db:validate:strict` and `pnpm test:db:integration`.
5. Compare schema fingerprints with the last approved production snapshot.

## Failback

1. Promote the recovered branch or restore traffic to the repaired primary.
2. Replay dead-letter worker rows and failed webhooks after connectivity returns.
3. Re-run booking and payment smoke suites.

## Verify

- Database probe is **reachable** on **Admin → Health**.
- `pnpm ops:verify-env` passes in the recovered environment.
- No cross-environment fingerprint overlap on **Admin → Environment**.
