# Environment Variables

## Web (repo root)

All web env vars go in `.env.local` at the repo root.

### Required for database

| Variable       | Used in                                           | Purpose                           |
| -------------- | ------------------------------------------------- | --------------------------------- |
| `POSTGRES_URL` | `db/drizzle.ts`, `drizzle.config.ts`, seed script | Neon PostgreSQL connection string |

### Required for full auth flow

| Variable               | Used in   | Purpose                                                       |
| ---------------------- | --------- | ------------------------------------------------------------- |
| `RESEND_API_KEY`       | `auth.ts` | Resend API key for transactional email                        |
| `RESEND_FROM_EMAIL`    | `auth.ts` | Verified sender address (defaults to `onboarding@resend.dev`) |
| `GOOGLE_CLIENT_ID`     | `auth.ts` | Google OAuth client ID                                        |
| `GOOGLE_CLIENT_SECRET` | `auth.ts` | Google OAuth client secret                                    |

### App URL (auth client)

| Variable                    | Used in                                    | Purpose                                                                                                                                |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | auth client/actions, `web-cors-origins.ts` | Public app base URL; also trusted when it passes the exact-origin policy                                                               |
| `BETTER_AUTH_URL`           | auth client/actions, `web-cors-origins.ts` | Auth server base URL; also trusted when it passes the exact-origin policy                                                              |
| `WEB_CORS_ORIGINS`          | `src/lib/web-cors-origins.ts`              | Optional comma-separated exact web origins; credentials, paths, query/hash, wildcards, and unsupported schemes are ignored             |
| `MOBILE_AUTH_CALLBACK_URLS` | `auth.ts`                                  | Optional comma-separated exact `playtt://`, `exp://`, or `exps://` callback URLs; unsupported schemes and wildcard entries are ignored |
| `BETTER_AUTH_TRUST_EXPO_GO` | `auth.ts`                                  | Set to `true` to enable broad Expo Go/dev-client origin patterns in production; development and test enable them by default            |

The auth clients default to `http://localhost:3000` when their URL variables
are unset. Trusted web origins are stricter: production defaults only to the
official PlayTT HTTPS origins and rejects HTTP or loopback values even when
configured. Non-production additionally trusts `http://localhost:3000` and
may accept explicitly configured safe HTTP/HTTPS origins.

### Payments (Paystack hosted checkout)

| Variable              | Used in                                                             | Purpose                                                                                                                     |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PAYSTACK_SECRET_KEY` | `src/server/payments/*`                                             | Paystack secret key for Initialize Transaction + webhooks                                                                   |
| `PAYSTACK_PUBLIC_KEY` | —                                                                   | Optional; not required for server-only flow                                                                                 |
| `CRON_SECRET`         | `src/app/api/cron/expire-bookings`, `src/app/api/cron/durable-work` | Bearer token for booking expiry, durable inbox/outbox workers, and session lifecycle reconciliation; required in production |

Register webhook URL on Paystack dashboard: `https://<host>/api/webhooks/paystack`

### Device fleet

| Variable                                   | Default                   | Purpose                                                                         |
| ------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------- |
| `DEVICE_CREDENTIAL_SECRET`                 | Development fallback only | HMAC pepper for enrollment codes and device credentials; required in production |
| `DEVICE_OFFLINE_THRESHOLD_SECONDS`         | `300`                     | Heartbeat age after which a device is reported offline                          |
| `DEVICE_HEARTBEAT_SAMPLE_INTERVAL_SECONDS` | `60`                      | Minimum interval between persisted heartbeat-history samples per device         |
| `DEVICE_HEARTBEAT_RETENTION_COUNT`         | `100`                     | Maximum sampled heartbeat rows retained per device by durable maintenance       |

Device-provided heartbeat timestamps may not exceed the server clock by more
than two minutes and cannot move a device's authoritative last-heartbeat time
backwards. Durable work performs command expiry/retry maintenance and heartbeat
history pruning.

### Replay development stub

| Variable                | Used in                              | Purpose                                                                                                              |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NVR_STUB_AUTO`         | replay request route and stub policy | Exact value `true` auto-completes replay clips only outside production; production ignores it                        |
| `REPLAY_WEBHOOK_SECRET` | `api/replays/[id]/ready`             | Required non-blank shared secret for the internal replay-ready callback; missing configuration returns retryable 503 |

The stub publishes `https://playtt.local/...` placeholder media and is a
development/test aid only. The route policy and the stub execution boundary
both block it in production.

The replay-ready callback authenticates `x-playtt-replay-secret` with a
constant-time digest comparison before parsing JSON. It accepts only bounded
HTTPS media URLs without embedded credentials and an optional trimmed title up
to 160 characters.

### Optional database pool

| Variable                | Default | Purpose                  |
| ----------------------- | ------- | ------------------------ |
| `POSTGRES_POOL_MIN`     | `5`     | Minimum pool connections |
| `POSTGRES_POOL_MAX`     | `20`    | Maximum pool connections |
| `POSTGRES_IDLE_TIMEOUT` | `30000` | Idle timeout in ms       |

### Test-only PostgreSQL integration harness

Set these explicitly in the shell that runs `pnpm test:db:integration`. The
harness does not load them from `.env.local`.

| Variable                       | Purpose                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PLAYTT_TEST_DATABASE_URL`     | Connection string for an intentionally disposable PostgreSQL test database. It must not target the same database as `POSTGRES_URL`. |
| `PLAYTT_TEST_DATABASE_CONFIRM` | Destructive-operation sentinel. Must equal `CREATE_AND_DROP_ISOLATED_PLAYTT_TEST_SCHEMA`.                                           |

The harness creates and drops only a generated `playtt_test_*` schema. See
`docs/database/disposable-postgres-tests.md` for its safety contract and the
current minimal-DDL limitation.

## Mobile (`playtt-mobile/`)

Copy `playtt-mobile/.env.example` to `playtt-mobile/.env` (or set in your shell).

| Variable              | Used in                    | Purpose                                                      |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL` | `playtt-mobile/lib/env.ts` | Base URL of the web/API backend (Better Auth at `/api/auth`) |

Defaults to `https://www.theplaytt.com`. For local dev, set `http://localhost:3000` or your LAN IP in `playtt-mobile/.env`.

### Apple Sign-In (web + mobile)

| Variable                      | Used in                         | Purpose                                                            |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `APPLE_CLIENT_ID`             | `auth.ts`, `verify-apple-token` | Services ID for Better Auth web OAuth (e.g. `com.theplaytt.auth`)  |
| `APPLE_APP_BUNDLE_IDENTIFIER` | `auth.ts`, `verify-apple-token` | iOS bundle ID for EAS/production builds (e.g. `com.theplaytt.app`) |
| `APPLE_EXPO_CLIENT_ID`        | `verify-apple-token`            | Expo Go audience; defaults to `host.exp.Exponent` when unset       |
| `APPLE_TEAM_ID`               | `apple-client-secret.ts`        | Apple Developer Team ID                                            |
| `APPLE_KEY_ID`                | `apple-client-secret.ts`        | Sign In with Apple key ID                                          |
| `APPLE_PRIVATE_KEY`           | `apple-client-secret.ts`        | `.p8` private key (use `\n` for line breaks)                       |

Mobile native Apple sign-in posts to `POST /api/apple/sign-in`. The identity token `aud` must match one of the allowed audiences above. Expo Go always uses `host.exp.Exponent`. Verify audience configuration in the deployment environment and with an authenticated Apple sign-in smoke test; the public `GET /api/version` route intentionally does not expose provider configuration or audience values.

### Production backend (web hosting)

When mobile uses the hosted API, ensure these are set on the server (e.g. Vercel):

| Variable                                    | Purpose                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                       | `https://www.theplaytt.com`                                           |
| `BETTER_AUTH_URL`                           | `https://www.theplaytt.com`                                           |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in                                                        |
| `BETTER_AUTH_TRUST_EXPO_GO`                 | Set `true` while testing in Expo Go (allows `exp://` OAuth redirects) |
| `APPLE_APP_BUNDLE_IDENTIFIER`               | `com.theplaytt.app` — required for EAS/production Apple sign-in       |
| `APPLE_EXPO_CLIENT_ID`                      | Optional; defaults to `host.exp.Exponent` for Expo Go testing         |

### Operator and device feature flags

`/operator` is allowed locally when `NODE_ENV` is not `production`. In production it stays closed unless the PlayTT tenant has an enabled `feature_flags` row, or the matching env override is set.

| Variable                   | Used in                              | Purpose                                                                                          |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `OPERATOR_SHELL_ENABLED`   | `src/server/operator/feature-policy` | Set `true` to allow `/operator` when no `operator_shell` flag row exists                         |
| `DEVICE_REGISTRY_ENABLED`  | `src/server/devices/feature-policy`  | Set `true` to allow `/operator/devices` when no `device_registry` flag row exists                |
| `PUBLIC_VENUE_API_ENABLED` | `src/server/catalog/feature-policy`  | Set `true` to allow the public venue API when no `public_venue_api` flag row exists              |

Phase 1 seed inserts enabled `operator_shell` and `device_registry` rows for the PlayTT tenant. Customer memberships cannot open `/admin`.

### Phase 5 access and automation

| Variable | Used in | Purpose |
| -------- | ------- | ------- |
| `PLAYTT_CREDENTIAL_KEYRING` | `src/server/access/*` | JSON keyring for encrypting revealable booking passcodes |
| `PLAYTT_PASSCODE_FINGERPRINT_KEY` | `src/server/access/*` | HMAC pepper for passcode fingerprints (never logs plaintext) |
| `PLAYTT_REMOTE_UNLOCK_OTP_PEPPER` | `src/server/access/admin-service` | Pepper for protected remote-unlock OTP verification |
| `TTLOCK_PROVIDER_MODE` | access provider factory | `simulator` (default) or `real` after Sciener commissioning |
| `LIVE_ACCESS_ENABLED` | `src/server/operator/feature-policy` | Env override when no `live_access` tenant flag row exists |
| `TTLOCK_PROVIDER_ENABLED` | feature policy | Env override for `ttlock_provider` |
| `RELAY_AUTOMATION_ENABLED` | feature policy | Env override for `relay_automation` |
| `ACCESS_NOTIFICATIONS_ENABLED` | feature policy | Env override for `access_notifications` |
| `REMOTE_UNLOCK_ENABLED` | feature policy | Env override for `remote_unlock` |

Phase 5 seed rows keep all access flags disabled. After physical commissioning, enable tenant flags with `node --env-file=.env.local scripts/enable-phase5-pilot-flags.mjs --confirm-commissioned`. See `docs/operations/certification/phase5-pilot-rollout.md`.

| Variable | Used in | Purpose |
| -------- | ------- | ------- |
| `PLAYTT_ADMIN_EMAIL` | `scripts/run-seed-phase1.mjs` | Optional. Promotes the matching user to PlayTT `owner` membership after seed (Super Admin access). |

## Notes

- Never commit `.env.local`, `.env`, or real secrets to version control.
- Seed script loads env via `node --env-file=.env.local`.
