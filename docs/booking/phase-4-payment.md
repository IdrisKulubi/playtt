# Phase 4 — Payment (Paystack M-Pesa)

Implemented for mobile bookings.

## Scope

- Paystack M-Pesa STK push via Charge API on checkout
- `POST /api/bookings/[id]/pay` — initiate payment
- `GET /api/bookings/[id]/payment` — poll + server-side verify fallback
- `POST /api/webhooks/paystack` — `charge.success` confirmation
- `POST /api/bookings/[id]/cancel` — release unpaid pending holds
- On success: `paymentStatus: paid`, `status: confirmed`
- Enforce `DEFAULT_PENDING_BOOKING_WINDOW_MINUTES` (10 min) expiry
- Confirmation email via Resend

## Files

| Layer | Path |
|-------|------|
| Paystack client | `src/server/payments/paystack-client.ts` |
| Payment service | `src/server/payments/service.ts` |
| Confirmation | `src/server/payments/confirm-booking.ts` |
| Pay route | `src/app/api/bookings/[id]/pay/route.ts` |
| Webhook | `src/app/api/webhooks/paystack/route.ts` |
| Expiry cron | `src/app/api/cron/expire-bookings/route.ts` |
| Mobile pay step | `playtt-mobile/components/booking/booking-payment-step.tsx` |
| Detail pay CTA | `playtt-mobile/components/booking/booking-detail-payment-actions.tsx` |

## Environment

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Charge API + webhook signature |
| `CRON_SECRET` | Optional bearer for expiry cron |
| `RESEND_API_KEY` | Confirmation email |

Register webhook: `https://<host>/api/webhooks/paystack`

## Mobile flow

1. Create pending booking (`POST /api/bookings`)
2. Pay step — `POST /api/bookings/[id]/pay` with optional phone override
3. Customer authorizes M-Pesa STK on phone (~180s window)
4. Webhook or poll confirms booking
5. Success screen — "You're booked!"

Unpaid bookings can also be paid from My Bookings detail sheet.

## Out of scope

- Web booking console checkout
- Paystack Popup / card payments
- Access card generation (Phase 5)
