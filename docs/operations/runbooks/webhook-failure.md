# Webhook failure recovery

Use when payment webhook inbox rows are in `failed` status.

## Check

1. Open **Admin → Durable work**.
2. Filter inbox rows with `failed` status and read `lastError`.

## Diagnose

- Paystack signature mismatch or clock skew.
- Booking already confirmed/expired causing processor rejection.
- Transient database error during confirmation.

## Recover

1. Confirm Paystack webhook secret and callback URL in environment config.
2. Replay the inbox row after fixing configuration.
3. Verify booking payment status and play session side effects.

## Verify

- Inbox row is `processed`.
- Booking timeline shows payment confirmed and session created.
- Worker health no longer reports failed webhooks.
