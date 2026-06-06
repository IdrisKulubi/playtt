# Environment Variables

## Web (repo root)

All web env vars go in `.env.local` at the repo root.

### Required for database

| Variable | Used in | Purpose |
|----------|---------|---------|
| `POSTGRES_URL` | `db/drizzle.ts`, `drizzle.config.ts`, seed script | Neon PostgreSQL connection string |

### Required for full auth flow

| Variable | Used in | Purpose |
|----------|---------|---------|
| `RESEND_API_KEY` | `auth.ts` | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | `auth.ts` | Verified sender address (defaults to `onboarding@resend.dev`) |
| `GOOGLE_CLIENT_ID` | `auth.ts` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `auth.ts` | Google OAuth client secret |

### App URL (auth client)

| Variable | Used in | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | `src/lib/auth-client.ts`, `src/actions/auth-actions.ts` | Public app base URL |
| `BETTER_AUTH_URL` | `src/lib/auth-client.ts`, `src/actions/auth-actions.ts` | Auth server base URL |

Both default to `http://localhost:3000` when unset.

### Optional database pool

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_POOL_MIN` | `5` | Minimum pool connections |
| `POSTGRES_POOL_MAX` | `20` | Maximum pool connections |
| `POSTGRES_IDLE_TIMEOUT` | `30000` | Idle timeout in ms |

## Mobile (`playtt-mobile/`)

Copy `playtt-mobile/.env.example` to `playtt-mobile/.env` (or set in your shell).

| Variable | Used in | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_API_URL` | `playtt-mobile/lib/env.ts` | Base URL of the web/API backend (Better Auth at `/api/auth`) |

Defaults to `http://localhost:3000`. Use your machine's LAN IP when testing on a physical device.

## Notes

- Never commit `.env.local`, `.env`, or real secrets to version control.
- Seed script loads env via `node --env-file=.env.local`.
