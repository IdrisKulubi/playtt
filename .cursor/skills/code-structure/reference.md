# Code Structure Reference

## Web routes (implemented)

| Route                                            | File                                                              | Purpose                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `/`                                              | `src/app/page.tsx`                                                | Marketing home                                           |
| `/book`                                          | `src/app/book/page.tsx`                                           | Booking flow                                             |
| `/dashboard`                                     | `src/app/dashboard/page.tsx`                                      | User dashboard                                           |
| `/bookings`                                      | `src/app/bookings/page.tsx`                                       | Upcoming and past bookings                               |
| `/bookings/[id]`                                 | `src/app/bookings/[id]/page.tsx`                                  | Booking detail and changes                               |
| `/activity`                                      | `src/app/activity/page.tsx`                                       | Player activity and replays                              |
| `/community`                                     | `src/app/community/page.tsx`                                      | Community preview                                        |
| `/operator/*`                                    | `src/app/operator/`                                               | Operator catalog inspection shell                        |
| `/pay/complete`                                  | `src/app/pay/complete/page.tsx`                                   | Hosted checkout completion                               |
| `/sign-in`                                       | `src/app/sign-in/page.tsx`                                        | Sign in                                                  |
| `/sign-up`                                       | `src/app/sign-up/page.tsx`                                        | Sign up                                                  |
| `/verify-email`                                  | `src/app/verify-email/page.tsx`                                   | Email verification                                       |
| `/reset-password`                                | `src/app/reset-password/page.tsx`                                 | Password reset request                                   |
| `/reset-password/confirm`                        | `src/app/reset-password/confirm/page.tsx`                         | Password reset confirm                                   |
| `/pod/scoreboard`                                | `src/app/pod/scoreboard/page.tsx`                                 | Kiosk live score display                                 |
| `/pod/tv`                                        | `src/app/pod/tv/page.tsx`                                         | TV live score display                                    |
| `/api/display/v1/resources/:resourceId/snapshot` | `src/app/api/display/v1/resources/[resourceId]/snapshot/route.ts` | Authoritative score snapshot                             |
| `/api/display/v1/resources/:resourceId/stream`   | `src/app/api/display/v1/resources/[resourceId]/stream/route.ts`   | SSE score hints                                          |
| `/api/auth/*`                                    | `src/app/api/auth/[...all]/route.ts`                              | better-auth API                                          |
| `/api/bookings/*`                                | `src/app/api/bookings/`                                           | Booking, payment, cancellation, modifications            |
| `/api/v1/venues/*`                               | `src/app/api/v1/venues/`                                          | Versioned public venue/resource catalog                  |
| `/api/operator/*`                                | `src/app/api/operator/`                                           | Operator catalog inspection                              |
| `/api/user/*`                                    | `src/app/api/user/`                                               | Profile and onboarding                                   |
| `/api/webhooks/paystack`                         | `src/app/api/webhooks/paystack/route.ts`                          | Paystack webhook                                         |
| `/api/replays/*`                                 | `src/app/api/replays/`                                            | Replay credits, requests, library                        |
| `/api/edge/v2/config`                            | `src/app/api/edge/v2/config/route.ts`                             | Authenticated VenueEdge multi-NVR configuration snapshot |
| `/api/edge/v2/config/applications`               | `src/app/api/edge/v2/config/applications/route.ts`                | VenueEdge config applied/rejected acknowledgement        |
| `/api/coach/*`                                   | `src/app/api/coach/`                                              | Coach subscription and content                           |
| `firmware/protocol/`                             | `firmware/protocol/`                                              | Shared device v1 protocol (debounce, buffer, client)     |
| `firmware/simulator/cli.mjs`                     | `firmware/simulator/cli.mjs`                                      | CLI device simulator (`pnpm sim:device`)                 |
| `firmware/esp32-controller/`                     | `firmware/esp32-controller/`                                      | ESP32-S3 flashable firmware (HTTPS to theplaytt.com)     |
| `docs/hardware/esp32-s3-desk-bringup.md`         | `docs/hardware/esp32-s3-desk-bringup.md`                          | Physical ESP32 desk bring-up checklist                   |

## Booking domain files

| File                                | Role                         |
| ----------------------------------- | ---------------------------- |
| `src/server/bookings/service.ts`    | Business logic orchestration |
| `src/server/bookings/repository.ts` | Database queries             |
| `src/server/bookings/pricing.ts`    | Pricing calculations         |
| `src/server/bookings/validators.ts` | Input validation             |
| `src/server/bookings/types.ts`      | Type definitions             |
| `src/server/bookings/constants.ts`  | Domain constants             |
| `src/actions/booking-actions.ts`    | Server Actions entry point   |

## Auth files

| File                                | Role                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `auth.ts`                           | better-auth server config (email OTP, 2FA, Google OAuth, Resend, Expo plugin) |
| `src/lib/auth-client.ts`            | Client-side auth helper                                                       |
| `src/actions/auth-actions.ts`       | Auth-related Server Actions                                                   |
| `playtt-mobile/lib/auth-client.ts`  | Mobile better-auth client                                                     |
| `playtt-mobile/lib/auth-api.ts`     | Direct auth HTTP calls (OTP, password reset)                                  |
| `playtt-mobile/lib/auth-schemas.ts` | Zod validation for auth forms                                                 |

## Database schema

Defined in `db/schema.ts`. Migrations live in `drizzle/`.

## Integration status

From `docs/system_overview.md` — do **not** assume these exist when reading or writing code:

| Integration                                 | Status                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paystack hosted payments + webhooks         | Implemented                                                                                                                                       |
| Booking modifications and account credits   | Implemented                                                                                                                                       |
| Replay credits and Coach product payments   | Implemented; mobile preview mode remains enabled                                                                                                  |
| Realtime broadcaster (SSE + optional Redis) | Implemented                                                                                                                                       |
| ESP32 device registry and scoring           | Implemented (P3-05/06); firmware simulator in `firmware/`                                                                                         |
| Cloudflare R2 private media                 | Planned                                                                                                                                           |
| TTLock smart locks                          | Planned; access UI is preview only                                                                                                                |
| Smart relays (lighting/HVAC)                | Planned                                                                                                                                           |
| Instant replay / camera pipeline            | VenueEdge v1 runtime plus Phase 1 multi-NVR schema/config v2 foundation implemented; production installer and failover runtime remain in progress |
| Push notifications (mobile)                 | Planned; preferences are local only                                                                                                               |

The platform-wide target and delivery sequence live in `docs/platform/`. When an integration status changes, update this file and the relevant skill/agent docs via `self-improving`.

## Mobile screens (current)

| Screen                  | File                                           |
| ----------------------- | ---------------------------------------------- |
| Marketing landing       | `playtt-mobile/app/index.tsx`                  |
| Sign in                 | `playtt-mobile/app/sign-in.tsx`                |
| Sign up                 | `playtt-mobile/app/sign-up.tsx`                |
| Verify email            | `playtt-mobile/app/verify-email.tsx`           |
| Forgot password         | `playtt-mobile/app/reset-password/index.tsx`   |
| Reset password confirm  | `playtt-mobile/app/reset-password/confirm.tsx` |
| Book                    | `playtt-mobile/app/book.tsx`                   |
| Home tab (Play + Coach) | `playtt-mobile/app/(app)/(tabs)/index.tsx`     |
| Bookings tab            | `playtt-mobile/app/(app)/(tabs)/bookings.tsx`  |
| Activity tab            | `playtt-mobile/app/(app)/(tabs)/activity.tsx`  |
| Community tab           | `playtt-mobile/app/(app)/(tabs)/community.tsx` |
| Account tab             | `playtt-mobile/app/(app)/(tabs)/account.tsx`   |
| Booking detail/edit     | `playtt-mobile/app/(app)/booking/[id]/`        |

Mobile auth testing guide: `playtt-mobile/docs/mobile-auth-phases.md`

## Product documentation

Both apps have docs folders:

- `docs/` — web-focused architecture and requirements
- `playtt-mobile/docs/` — product, design system, user journey

Use these as the source of truth for planned features not yet built in code.
