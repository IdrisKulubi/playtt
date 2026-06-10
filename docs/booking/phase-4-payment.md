# Phase 4 — Payment (Paystack M-Pesa + Card)

Implemented for mobile bookings.

## Scope

- **M-Pesa:** Paystack STK push via Charge API
- **Card:** Paystack hosted checkout via Initialize Transaction (`channels: ["card"]`)
- `POST /api/bookings/[id]/pay` — initiate payment (`method: "mpesa" | "card"`)
- `GET /api/bookings/[id]/payment` — poll + server-side verify fallback
- `POST /api/webhooks/paystack` — `charge.success` confirmation (both methods)
- `POST /api/bookings/[id]/cancel` — release unpaid pending holds
- On success: `paymentStatus: paid`, `status: confirmed`
- Enforce `DEFAULT_PENDING_BOOKING_WINDOW_MINUTES` (10 min) expiry
- Confirmation email via Resend
- Web callback page: `/pay/complete` (card checkout return URL)

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
| Method picker | `playtt-mobile/components/booking/payment-method-picker.tsx` |
| Card browser helper | `playtt-mobile/lib/payment-browser.ts` |
| Detail pay CTA | `playtt-mobile/components/booking/booking-detail-payment-actions.tsx` |

## Environment

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Charge + Initialize Transaction + webhook signature |
| `NEXT_PUBLIC_APP_URL` | Card `callback_url` base (`/pay/complete`) |
| `CRON_SECRET` | Optional bearer for expiry cron |
| `RESEND_API_KEY` | Confirmation email |

Register webhook: `https://<host>/api/webhooks/paystack`

## Mobile flow

### M-Pesa (default)

1. Create pending booking (`POST /api/bookings`)
2. Pay step — select M-Pesa → `POST /api/bookings/[id]/pay` with `{ method: "mpesa", phone? }`
3. Customer authorizes STK on phone (~180s window)
4. Webhook or poll confirms booking

### Card

1. Create pending booking
2. Pay step — select Card → `POST /api/bookings/[id]/pay` with `{ method: "card" }`
3. App opens `authorizationUrl` in secure browser (`expo-web-browser`)
4. Customer completes Paystack checkout (3DS, OTP as needed)
5. Redirect to `/pay/complete` closes browser; webhook or poll confirms booking

Unpaid bookings can also be paid from My Bookings detail sheet.

## Out of scope

- Web booking console checkout
- Saved cards / charge authorization reuse
- Apple Pay channel
- Access card generation (Phase 5)
