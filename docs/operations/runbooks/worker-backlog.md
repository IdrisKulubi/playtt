# Worker backlog recovery

Use when inbox/outbox pending counts are elevated but no dead letters exist yet.

## Check

1. Open **Admin → Durable work**.
2. Review inbox/outbox backlog counts by status.

## Diagnose

- Cron worker not keeping up during traffic spike.
- Slow downstream consumer (email, lifecycle, replay ready).
- Large batch of historical events replayed at once.

## Recover

1. Confirm durable work cron is running every minute in production.
2. Temporarily scale worker frequency or run manual cron invoke if supported.
3. Clear blocking dead letters before backlog can drain.

## Verify

- Pending counts return to normal baseline.
- New bookings confirm without delay.
- Worker health returns to **Healthy**.
