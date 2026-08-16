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

| Variable                    | Used in                                                 | Purpose                                                                                                         |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | `src/lib/auth-client.ts`, `src/actions/auth-actions.ts` | Public app base URL                                                                                             |
| `BETTER_AUTH_URL`           | `src/lib/auth-client.ts`, `src/actions/auth-actions.ts` | Auth server base URL                                                                                            |
| `WEB_CORS_ORIGINS`          | `src/lib/web-cors-origins.ts`                           | Optional comma-separated additional trusted web origins                                                         |
| `MOBILE_AUTH_CALLBACK_URLS` | `auth.ts`                                               | Optional comma-separated mobile OAuth callback URLs to trust, useful for exact Expo Go/dev-client callback URLs |

Both default to `http://localhost:3000` when unset.

### Payments (Paystack hosted checkout)

| Variable              | Used in                            | Purpose                                                      |
| --------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `PAYSTACK_SECRET_KEY` | `src/server/payments/*`            | Paystack secret key for Initialize Transaction + webhooks    |
| `PAYSTACK_PUBLIC_KEY` | —                                  | Optional; not required for server-only flow                  |
| `CRON_SECRET`         | `src/app/api/cron/expire-bookings` | Bearer token for booking expiry cron; required in production |

Register webhook URL on Paystack dashboard: `https://<host>/api/webhooks/paystack`

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

Mobile native Apple sign-in posts to `POST /api/apple/sign-in`. The identity token `aud` must match one of the allowed audiences above. Expo Go always uses `host.exp.Exponent`.

Verify configured audiences: `GET /api/version` → `apple.audiences`.

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

## Notes

- Never commit `.env.local`, `.env`, or real secrets to version control.
- Seed script loads env via `node --env-file=.env.local`.
