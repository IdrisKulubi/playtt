# Code Structure Reference

## Web routes (implemented)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/app/page.tsx` | Marketing home |
| `/book` | `src/app/book/page.tsx` | Booking flow |
| `/dashboard` | `src/app/dashboard/page.tsx` | User dashboard |
| `/sign-in` | `src/app/sign-in/page.tsx` | Sign in |
| `/sign-up` | `src/app/sign-up/page.tsx` | Sign up |
| `/verify-email` | `src/app/verify-email/page.tsx` | Email verification |
| `/reset-password` | `src/app/reset-password/page.tsx` | Password reset request |
| `/reset-password/confirm` | `src/app/reset-password/confirm/page.tsx` | Password reset confirm |
| `/api/auth/*` | `src/app/api/auth/[...all]/route.ts` | better-auth API |

## Booking domain files

| File | Role |
|------|------|
| `src/server/bookings/service.ts` | Business logic orchestration |
| `src/server/bookings/repository.ts` | Database queries |
| `src/server/bookings/pricing.ts` | Pricing calculations |
| `src/server/bookings/validators.ts` | Input validation |
| `src/server/bookings/types.ts` | Type definitions |
| `src/server/bookings/constants.ts` | Domain constants |
| `src/actions/booking-actions.ts` | Server Actions entry point |

## Auth files

| File | Role |
|------|------|
| `auth.ts` | better-auth server config (email OTP, 2FA, Google OAuth, Resend, Expo plugin) |
| `src/lib/auth-client.ts` | Client-side auth helper |
| `src/actions/auth-actions.ts` | Auth-related Server Actions |
| `playtt-mobile/lib/auth-client.ts` | Mobile better-auth client |
| `playtt-mobile/lib/auth-api.ts` | Direct auth HTTP calls (OTP, password reset) |
| `playtt-mobile/lib/auth-schemas.ts` | Zod validation for auth forms |

## Database schema

Defined in `db/schema.ts`. Migrations live in `drizzle/`.

## Planned but not in code yet

From `docs/system_overview.md` — do **not** assume these exist when reading or writing code:

| Integration | Status |
|-------------|--------|
| Paystack payments | Planned |
| WebSockets (Socket.io / Pusher) | Planned |
| TTLock smart locks | Planned |
| Smart relays (lighting/HVAC) | Planned |
| Instant replay / camera pipeline | Planned |
| Push notifications (mobile) | Planned |

When implementing these, update this file and the relevant skill/agent docs via `self-improving`.

## Mobile screens (current)

| Screen | File |
|--------|------|
| Marketing landing | `playtt-mobile/app/index.tsx` |
| Sign in | `playtt-mobile/app/sign-in.tsx` |
| Sign up | `playtt-mobile/app/sign-up.tsx` |
| Verify email | `playtt-mobile/app/verify-email.tsx` |
| Forgot password | `playtt-mobile/app/reset-password/index.tsx` |
| Reset password confirm | `playtt-mobile/app/reset-password/confirm.tsx` |
| Book | `playtt-mobile/app/book.tsx` |
| Home tab (sign-out) | `playtt-mobile/app/(app)/(tabs)/index.tsx` |
| Explore tab | `playtt-mobile/app/(app)/(tabs)/explore.tsx` |

Mobile auth testing guide: `playtt-mobile/docs/mobile-auth-phases.md`

## Product documentation

Both apps have docs folders:

- `docs/` — web-focused architecture and requirements
- `playtt-mobile/docs/` — product, design system, user journey

Use these as the source of truth for planned features not yet built in code.
