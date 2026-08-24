# Disaster recovery overview

PlayTT recovery is rehearsed per environment with isolated infrastructure and documented runbooks.

## Recovery objectives

| Area | RPO | RTO | Runbook |
| --- | --- | --- | --- |
| Database | ≤ 24 hours | ≤ 4 hours | `database-restore.md` |
| R2 media | Provider durability | ≤ 4 hours | `infrastructure-r2.md` |
| Secrets | N/A | ≤ 1 hour | `secret-rotation.md` |
| Migrations | N/A | Before rollout | `migration-rehearsal.md` |

## Environment isolation

1. Open **Admin → Environment** in each deployment.
2. Compare credential fingerprints across dev, preview, staging, and production.
3. Set `PLAYTT_BLOCKED_RESOURCE_FINGERPRINTS` in non-production deployments to the production fingerprint list so shared credentials fail closed.

## Rehearsal order

1. Restore or branch the database into an isolated Neon instance.
2. Run `pnpm db:migrate` and `pnpm test:db:integration`.
3. Rotate affected secrets and redeploy.
4. Run `pnpm ops:verify-env`, `pnpm test:operations`, and product smoke suites.
5. Record evidence in the deployment checklist before promoting traffic.

## Verify

- `/admin/environment` reports `ok` or only expected warnings.
- `pnpm ops:verify-env` exits 0 in CI and staging.
- Booking, payment, replay, and worker smoke suites pass against the recovered environment.
