# Phase 4 — Payment (Paystack hosted checkout)

Implemented for mobile bookings.

## Scope

- Paystack hosted checkout via Initialize Transaction (card, M-Pesa, and other enabled channels)
- `POST /api/bookings/[id]/pay` — initiate payment (no body required)
- `GET /api/bookings/[id]/payment` — poll + server-side verify fallback
- `POST /api/webhooks/paystack` — `charge.success` confirmation
- `POST /api/bookings/[id]/cancel` — release unpaid pending holds
- On success: `paymentStatus: paid`, `status: confirmed`
- Enforce `DEFAULT_PENDING_BOOKING_WINDOW_MINUTES` (10 min) expiry
- Confirmation email via Resend
- Web callback page: `/pay/complete` (checkout return URL)

## Files

| Layer | Path |
|-------|------|
| Paystack client | `src/server/payments/paystack-client.ts` |
| Payment service | `src/server/payments/service.ts` |
| Confirmation | `src/server/payments/confirm-booking.ts` |
| Pay route | `src/app/api/bookings/[id]/pay/route.ts` |
| Webhook | `src/app/api/webhooks/paystack/route.ts` |
| Callback page | `src/app/pay/complete/page.tsx` |
| Expiry cron | `src/app/api/cron/expire-bookings/route.ts` |
| Mobile pay step | `playtt-mobile/components/booking/booking-payment-step.tsx` |
| Checkout browser helper | `playtt-mobile/lib/payment-browser.ts` |
| Detail pay CTA | `playtt-mobile/components/booking/booking-detail-payment-actions.tsx` |

## Environment

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Initialize Transaction + webhook signature |
| `NEXT_PUBLIC_APP_URL` | Checkout `callback_url` base (`/pay/complete`) |
| `CRON_SECRET` | Optional bearer for expiry cron |
| `RESEND_API_KEY` | Confirmation email |

Register webhook: `https://<host>/api/webhooks/paystack`

## Mobile flow

1. Create pending booking (`POST /api/bookings`)
2. Pay step — tap **Pay now** → `POST /api/bookings/[id]/pay`
3. App opens `authorizationUrl` in secure browser (`expo-web-browser`)
4. Customer picks card, M-Pesa, or other method on Paystack hosted page
5. Redirect to `/pay/complete` closes browser; webhook or poll confirms booking

Unpaid bookings can also be paid from My Bookings detail sheet.

## Out of scope

- Web booking console checkout
- Saved cards / charge authorization reuse
- Apple Pay channel
- Access card generation (Phase 5)
