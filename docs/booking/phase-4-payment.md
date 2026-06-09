# Phase 4 — Payment (deferred)

Not implemented in v1. Document for future work.

## Scope

- Paystack M-Pesa STK push on checkout
- `POST /api/bookings/[id]/pay`
- Webhook `POST /api/webhooks/paystack`
- On success: `paymentStatus: paid`, `status: confirmed`
- Enforce `DEFAULT_PENDING_BOOKING_WINDOW_MINUTES` (10 min) expiry
- Email/SMS confirmation via Resend

## Dependencies

- Phase 1–3 booking flow complete
- Paystack account + webhook URL on production
