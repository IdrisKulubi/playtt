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

Defaults to `https://www.theplaytt.com`. For local dev, set `http://localhost:3000` or your LAN IP in `playtt-mobile/.env`.

### Production backend (web hosting)

When mobile uses the hosted API, ensure these are set on the server (e.g. Vercel):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://www.theplaytt.com` |
| `BETTER_AUTH_URL` | `https://www.theplaytt.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `BETTER_AUTH_TRUST_EXPO_GO` | Set `true` while testing in Expo Go (allows `exp://` OAuth redirects) |

## Notes

- Never commit `.env.local`, `.env`, or real secrets to version control.
- Seed script loads env via `node --env-file=.env.local`.
