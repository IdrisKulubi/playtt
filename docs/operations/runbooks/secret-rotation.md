# Secret rotation

Use when API keys, auth secrets, or provider credentials are rotated or suspected compromised.

## Check

1. Open **Admin → Environment** and note current credential fingerprints.
2. Identify every service that reads the affected variable.

## Rotate

1. Issue the replacement secret in the provider console.
2. Update hosted environment variables for one environment at a time.
3. Redeploy the web app and any affected edge services.
4. Revoke the previous secret only after probes and smoke tests pass.

## Common variables

- `BETTER_AUTH_SECRET`
- `CRON_SECRET`
- `PAYSTACK_SECRET_KEY`
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
- `REDIS_URL`
- Device and edge enrollment credentials

## Verify

- **Admin → Environment** fingerprints change only in the intended deployment.
- `pnpm ops:verify-env` exits 0.
- Auth, payments, cron, media upload, and realtime smoke tests pass.
