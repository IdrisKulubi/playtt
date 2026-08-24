# Worker dead letter recovery

Use when webhook inbox or outbox events are in `dead_letter` status.

## Check

1. Open **Admin → Durable work**.
2. Review dead-letter inbox and outbox rows.
3. Note `eventType`, `lastError`, and `attempts`.

## Diagnose

- Payment webhook dead letters often indicate booking confirmation side effects failed.
- Outbox dead letters may block confirmation email or session lifecycle consumers.

## Recover

1. Fix the underlying error (schema drift, provider outage, bad payload).
2. Replay the dead-letter row from the durable work panel (owner role required).
3. Confirm the row moves to `processed` or a retryable state.

## Verify

- No dead-letter rows remain for the tenant.
- Affected booking timeline shows payment/session events after replay.
- Worker health returns to **Healthy** on **Admin → Health**.
