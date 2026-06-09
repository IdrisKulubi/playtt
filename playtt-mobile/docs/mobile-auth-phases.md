# Mobile Auth — Phased Guide

Follow these phases to set up, test, and verify PlayTT mobile authentication (email/password, email verification, password reset, sign-out).

## Architecture

- **Backend:** Next.js at repo root — Better Auth at `/api/auth/*`
- **Mobile:** Expo app in `playtt-mobile/` — `@better-auth/expo` + SecureStore
- **Emails:** Resend (OTP verification + password reset)

```
Mobile app  --EXPO_PUBLIC_API_URL-->  Web API (/api/auth)
     |                                      |
  SecureStore                          PostgreSQL + Resend
```

---

## Phase 0 — Prerequisites

### Backend option A — Production (recommended)

Mobile defaults to the hosted API at **https://www.theplaytt.com**.

1. Ensure `playtt-mobile/.env` contains:

```env
EXPO_PUBLIC_API_URL=https://www.theplaytt.com
```

2. On production hosting, set `BETTER_AUTH_TRUST_EXPO_GO=true` while testing in **Expo Go** (OAuth uses `exp://` redirects).
3. Google Cloud Console redirect URI must include `https://www.theplaytt.com/api/auth/callback/google`.

Restart Metro after changing env: `npm start -- --clear`.

### Backend option B — Local development

From the repo root:

```bash
pnpm install
pnpm dev
```

Web runs at `http://localhost:3000`. Set `EXPO_PUBLIC_API_URL=http://localhost:3000` in `playtt-mobile/.env` (simulator) or your LAN IP on a physical device.

### 2. Configure web environment

Create `.env.local` at the repo root with at least:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Neon PostgreSQL connection |
| `RESEND_API_KEY` | Send OTP and reset emails |
| `RESEND_FROM_EMAIL` | Verified sender in Resend |
| `GOOGLE_CLIENT_ID` | Optional — Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Optional — Google sign-in |
| `APPLE_CLIENT_ID` | Services ID — Apple sign-in (e.g. `com.theplaytt.auth`) |
| `APPLE_APP_BUNDLE_IDENTIFIER` | iOS bundle ID (e.g. `com.theplaytt.app`) |
| `APPLE_EXPO_CLIENT_ID` | Expo Go audience (`host.exp.Exponent`) while testing in Expo Go |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | Sign In with Apple key ID |
| `APPLE_PRIVATE_KEY` | `.p8` private key (use `\n` for line breaks) |

See `.cursor/skills/run-project/env-reference.md` for the full list.

### 3. Configure mobile environment

```bash
cd playtt-mobile
cp .env.example .env
```

| Variable | Production | Local simulator | Local physical device |
|----------|------------|-----------------|----------------------|
| `EXPO_PUBLIC_API_URL` | `https://www.theplaytt.com` | `http://localhost:3000` | `http://<your-lan-ip>:3000` |

### 4. Start the mobile app

```bash
cd playtt-mobile
npm install
npm start
```

Use **`npm start`**, not `npx expo start` (avoids legacy global expo-cli on Windows).

### 5. Troubleshooting setup

| Problem | Fix |
|---------|-----|
| `Cannot find module '@expo/schema-utils'` | Run `npm install` in `playtt-mobile/`, use `npm start` |
| Empty `node_modules/.bin` | Run `npm install` again |
| Network request failed | Use `https://www.theplaytt.com` for production, or LAN IP for local dev; restart with `npm start -- --clear` |
| Google OAuth fails in Expo Go (prod API) | Set `BETTER_AUTH_TRUST_EXPO_GO=true` on production hosting |
| Emails not arriving | Verify Resend API key and sender domain |

---

## Phase 1 — Sign up (create account)

### Steps

1. Open the app landing screen → tap **Create account**
2. Fill in: full name, email, password (8+ chars), confirm password
3. Tap **Create account**

### Expected behavior

- `POST /api/auth/sign-up/email` succeeds
- Verification OTP email is sent via Resend
- App navigates to `/verify-email?email=...`

### Test cases

| Case | Expected |
|------|----------|
| Passwords don't match | Inline validation error |
| Password under 8 chars | Inline validation error |
| Email already registered | Error message from API |
| Valid new account | Navigate to verify-email screen |

---

## Phase 2 — Verify email (OTP)

### Steps

1. Check inbox for 6-digit verification code
2. Enter code on the verify-email screen
3. Tap **Verify and continue**

### Expected behavior

- `POST /api/auth/email-otp/verify-email` succeeds
- Session is created and stored in SecureStore
- App navigates to `/(app)/(tabs)` dashboard

### Test cases

| Case | Expected |
|------|----------|
| Wrong OTP | Error message |
| Tap **Resend code** | New email sent, success message shown |
| Missing email param | Redirect to sign-up |

---

## Phase 3 — Sign in (email + password)

### Steps

1. From dashboard, tap **Sign out**
2. On landing, tap **Sign in**
3. Enter email and password → tap **Sign in**

### Expected behavior

- `POST /api/auth/sign-in/email` succeeds
- Session restored → dashboard

### Test cases

| Case | Expected |
|------|----------|
| Wrong password | Error message |
| 2FA enabled on account | OTP step appears after password |
| Already signed in | Redirect to dashboard (no form flash) |
| **Forgot?** link | Navigate to `/reset-password` |

### Google sign-in (optional)

Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the backend. Tap **Continue with Google** — browser OAuth flow returns to app via `playtt://` scheme.

### Apple sign-in (iOS)

Mobile uses native `expo-apple-authentication` and posts to **`POST /api/apple/sign-in`** (not Better Auth `signIn.social`). The backend verifies the Apple JWT, upserts `user`/`account`, creates a `session`, and returns a Bearer token stored in `playtt_session`.

| Requirement | Value |
|-------------|-------|
| iOS bundle ID | `com.theplaytt.app` in `app.json` (`usesAppleSignIn: true`) |
| Expo Go testing | Set `APPLE_EXPO_CLIENT_ID=host.exp.Exponent` on production backend |
| Production build | `APPLE_APP_BUNDLE_IDENTIFIER=com.theplaytt.app` |

Manual test: tap **Apple** → native sheet → `POST /api/apple/sign-in` 200 → home with session in SecureStore.

---

## Phase 4 — Password reset (OTP)

### Steps

1. On sign-in, tap **Forgot?** (or go to `/reset-password`)
2. Enter account email → tap **Continue**
3. App navigates to `/reset-password/confirm?email=...`
4. Enter 6-digit code from email + new password → tap **Continue**
5. Sign in with the new password

### Expected behavior

- Reset email contains OTP with subject "Reset your PlayTT password"
- `POST /api/auth/email-otp/request-password-reset` sends the code
- `POST /api/auth/email-otp/reset-password` succeeds
- Redirect to sign-in

### Test cases

| Case | Expected |
|------|----------|
| Unknown email | Navigate to confirm (no account enumeration) |
| Expired/invalid OTP | Error on confirm screen |
| Weak password | Inline validation error |
| Open confirm without email | Prompt to request new code |
| Resend code | New OTP sent |

---

## Phase 5 — Session persistence

### Steps

1. Sign in successfully
2. Force-quit the app
3. Reopen the app → navigate to a protected route

### Expected behavior

- Session persists via Expo SecureStore
- `(app)/_layout.tsx` allows access without re-signing-in
- **Sign out** clears session and returns to `/sign-in`

---

## Phase 6 — Device QA matrix

| Environment | `EXPO_PUBLIC_API_URL` | Notes |
|-------------|----------------------|-------|
| iOS Simulator | `http://localhost:3000` | Works out of the box |
| Android Emulator | `http://10.0.2.2:3000` | Android localhost alias |
| Physical device | `http://<lan-ip>:3000` | Same Wi-Fi as dev machine |
| Google OAuth | Any reachable URL | Needs Google credentials in `.env.local` |

### Auth routes (mobile)

| Route | Screen |
|-------|--------|
| `/sign-in` | Email/password + Google sign-in |
| `/sign-up` | Create account |
| `/verify-email` | OTP verification |
| `/reset-password` | Request reset code |
| `/reset-password/confirm` | Enter OTP + set new password |
| `/(app)/(tabs)` | Authenticated home (sign-out) |

---

## API reference (mobile → backend)

| Flow | Client call | HTTP endpoint |
|------|-------------|---------------|
| Sign up | `authClient.signUp.email` | `POST /api/auth/sign-up/email` |
| Send OTP | `sendVerificationOtp()` | `POST /api/auth/email-otp/send-verification-otp` |
| Verify email | `authClient.emailOtp.verifyEmail` | `POST /api/auth/email-otp/verify-email` |
| Sign in | `authClient.signIn.email` | `POST /api/auth/sign-in/email` |
| 2FA | `authClient.twoFactor.verifyOtp` | `POST /api/auth/two-factor/verify-otp` |
| Request reset | `requestPasswordReset()` | `POST /api/auth/email-otp/request-password-reset` |
| Confirm reset | `authClient.emailOtp.resetPassword` | `POST /api/auth/email-otp/reset-password` |
| Sign out | `authClient.signOut()` | `POST /api/auth/sign-out` |
| Session | `useSession()` / `getSession()` | `GET /api/auth/get-session` |

Implementation files: `playtt-mobile/lib/auth-client.ts`, `playtt-mobile/lib/auth-api.ts`.
