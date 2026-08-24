# Database health recovery

Use when the live database probe fails on **Admin → Health**.

## Check

1. Open **Admin → Health** and confirm the database dimension is **Down**.
2. Check hosted Postgres status and connection limits.
3. Review recent deployment or migration activity.

## Diagnose

- Invalid or rotated `POSTGRES_URL`.
- Network partition between app and database.
- Database maintenance or failover in progress.

## Recover

1. Verify `POSTGRES_URL` in the hosted environment.
2. Restore connectivity or fail over to the healthy replica.
3. Run `pnpm db:migrate` against the recovered instance if schema drift is suspected.
4. Replay any dead-letter worker rows after the database is healthy.

## Verify

- Database probe shows **reachable** with latency on **Admin → Health**.
- Bookings and payments complete without 5xx errors.
