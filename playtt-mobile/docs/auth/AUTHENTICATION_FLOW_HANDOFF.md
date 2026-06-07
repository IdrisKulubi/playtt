# PlayTT Authentication Flow Handoff

This guide defines the authentication pattern for PlayTT: one hosted Next.js
backend owns auth, database, email, and protected APIs; the Expo mobile app is a
native shell that stores a session locally and calls the backend with Bearer
tokens.

## Target Architecture

- **Backend/web:** repo root Next.js app, Better Auth at `/api/auth/*`.
- **Mobile:** `playtt-mobile/`, Expo Router, `@better-auth/expo`, SecureStore.
- **Hosted backend URL:** `https://www.theplaytt.com` unless overridden by
  `EXPO_PUBLIC_API_URL`.
- **Mobile deep-link scheme:** `playtt`.
- **SecureStore prefix:** `playtt`.

The web app may use normal cookie auth because it runs on the backend domain.
The native app must not depend on browser cookies for protected API calls. It
sends:

```http
Authorization: Bearer <raw-session-token>
```

## Current Implementation Files

Backend:

- `auth.ts` - Better Auth config, Expo server plugin, trusted origins.
- `src/lib/web-cors-origins.ts` - trusted web origins for the shared backend.
- `src/app/api/auth/[...all]/route.ts` - Better Auth Next route.
- `src/lib/security.ts` - cookie session plus Bearer-token fallback.
- `src/app/api/user/me/route.ts` - mobile bootstrap/profile endpoint.
- `db/schema.ts` - Better Auth-compatible `user`, `account`, `session`,
  `verification` tables.

Mobile:

- `playtt-mobile/lib/auth-client.ts` - Better Auth Expo client.
- `playtt-mobile/lib/auth-helpers.ts` - SecureStore token lookup and cleanup.
- `playtt-mobile/lib/api-client.ts` - backend fetch wrapper with Bearer auth.
- `playtt-mobile/lib/session-cache.ts` - last known authenticated route cache.
- `playtt-mobile/components/session-bootstrap.tsx` - explicit session-expiry
  handler.
- `playtt-mobile/app/index.tsx` - startup route bootstrap.
- `playtt-mobile/app/(app)/_layout.tsx` - local-token protected app shell.

## Backend Requirements

`auth.ts` must include:

- `expo()` from `@better-auth/expo`.
- `TRUSTED_ORIGINS = [...WEB_CORS_ORIGINS, ...MOBILE_TRUSTED_ORIGINS]`.
- trusted origins for `playtt://`, `playtt:///`, `playtt://*`.
- hosted web origin from `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`.
- Expo dev origins while testing, controlled by development mode or
  `BETTER_AUTH_TRUST_EXPO_GO=true`.
- optional exact mobile callback URLs through `MOBILE_AUTH_CALLBACK_URLS`, a
  comma-separated env var for Expo Go/dev-client callback URLs.
- Google credentials in the hosted backend environment when Google login is
  enabled.
- the same `TRUSTED_ORIGINS` passed both as top-level `trustedOrigins` and
  through the `playtt-trusted-origins` Better Auth plugin.

Protected APIs used by mobile must resolve auth with:

```ts
getSessionWithBearerFallback(req)
```

That helper first tries Better Auth's normal cookie/session resolution. If that
fails, it reads `Authorization: Bearer <token>`, strips any signed-cookie suffix
after `.`, and checks the raw token against `session.token` in PostgreSQL.

Do not protect mobile-called APIs with only `auth.api.getSession()`.

## Mobile Requirements

`playtt-mobile/lib/auth-client.ts` must keep these values in sync:

```ts
expoClient({
  scheme: "playtt",
  storagePrefix: "playtt",
  storage: SecureStore,
})
```

`EXPO_PUBLIC_API_URL` points the shell at the backend:

```env
EXPO_PUBLIC_API_URL=https://www.theplaytt.com
```

For local backend testing:

- simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`
- physical device: `http://<lan-ip>:3000`

Restart Metro after changing env.

## Login Flow

```text
User signs in on mobile
  -> Better Auth endpoint on hosted/backend web app
  -> Backend creates/loads user and session in shared DB
  -> Better Auth Expo plugin writes session data to SecureStore
  -> Mobile waits until SecureStore contains a token
  -> Mobile routes to app shell
  -> Mobile calls /api/user/me with Authorization: Bearer <token>
```

The mobile app should not trust an OAuth redirect alone. After social login,
wait until `getStoredAuth()` can read a token from SecureStore.

For Google social login, use a relative callback URL and let the Better Auth
Expo plugin convert it with `Linking.createURL()`:

```ts
authClient.signIn.social({
  provider: "google",
  callbackURL: "/",
})
```

The Expo root layout must also call:

```ts
WebBrowser.maybeCompleteAuthSession()
```

This lets Expo complete/dismiss the OAuth browser session after the deep-link
handoff.

If the backend returns `INVALID_CALLBACK_URL`, inspect the backend log for the
exact rejected callback and add it to hosted backend env:

```env
MOBILE_AUTH_CALLBACK_URLS=exp://192.168.1.20:8081/--/
BETTER_AUTH_TRUST_EXPO_GO=true
```

Then restart or redeploy the backend. Hosted backend changes are not picked up
by the mobile app alone.

## Startup Flow

On app launch:

1. Read SecureStore with `getStoredAuth()`.
2. If no token exists, show the landing/sign-in path.
3. If a token exists, route to the cached authenticated route or
   `/(app)/(tabs)`.
4. Refresh `/api/user/me` in the background.
5. If the network is unavailable, keep the user signed in locally.
6. Clear local auth only when the backend explicitly returns an invalid session
   code such as `UNAUTHENTICATED`, `INVALID_TOKEN`, or `SESSION_EXPIRED`.

## Logout Flow

Use `clearSession()` from `playtt-mobile/lib/auth-helpers.ts`.

It attempts backend sign-out, then deletes all known PlayTT SecureStore auth
keys and the route cache. Local cleanup still runs if the backend is
unreachable.

## Local Sanity Test

1. Run the web backend or point mobile at `https://www.theplaytt.com`.
2. Start Expo with `npm start` from `playtt-mobile/`.
3. Sign in with email or Google.
4. Confirm the app reaches `/(app)/(tabs)`.
5. Confirm `GET /api/user/me` succeeds with a Bearer token.
6. Kill and reopen the app; it should route from local token/cache.
7. Disable network and reopen; it should not log out just because the backend is
   unreachable.
8. Sign out; SecureStore auth keys and route cache should be cleared.

## Common Mistakes

- Do not mismatch `app.json` scheme and `expoClient({ scheme })`.
- Do not change `storagePrefix` without updating SecureStore helper keys.
- Do not point a physical device at `localhost`; use the machine LAN IP.
- Do not clear the session on generic network errors.
- Do not assume login means all onboarding is complete; route from backend state
  returned by `/api/user/me` as PlayTT adds more profile/onboarding fields.
