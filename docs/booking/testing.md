# Booking — Testing Checklist

## Phase 1 (API)

- [ ] `GET /api/bookings/bootstrap` returns Hurlingham
- [ ] Availability excludes past slots for today
- [ ] Double-book same slot returns 409 `SLOT_UNAVAILABLE`
- [ ] Create without auth returns 401
- [ ] Create without onboarding returns 400 `ONBOARDING_INCOMPLETE`
- [ ] `GET /api/bookings/mine` returns user's bookings only

## Phase 2 (Mobile UI)

- [ ] Full flow: venue → time → review → confirm
- [ ] Toast on slot conflict
- [ ] Toast on network error
- [ ] Past slots not selectable

## Phase 3 (My Bookings)

- [ ] New booking appears in Bookings tab
- [ ] Detail screen matches created booking
- [ ] Home shows upcoming card when applicable
- [ ] Sign out / sign in preserves list

## Phase 4 (Payment)

- [ ] `POST /api/bookings/[id]/pay` triggers M-Pesa STK (test key)
- [ ] `payments` row created with Paystack reference
- [ ] Webhook `charge.success` sets booking `confirmed` + `paid`
- [ ] Replay webhook is idempotent (no double confirm)
- [ ] `GET /api/bookings/[id]/payment` verifies delayed payments
- [ ] Unpaid booking expires after 10 minutes (`expired` status)
- [ ] Expired booking no longer blocks slot availability
- [ ] Mobile: slot → players → confirm → pay → success screen
- [ ] Mobile: pay from My Bookings detail sheet for abandoned hold
- [ ] `POST /api/bookings/[id]/cancel` releases unpaid pending booking
- [ ] Confirmation email sent on successful payment (when Resend configured)

### Card payments

- [ ] `POST /api/bookings/[id]/pay` with `{ "method": "card" }` returns `authorizationUrl`
- [ ] `payments` row created with `paymentMethod: card`
- [ ] Paystack test card `4084 0840 8408 4081` completes hosted checkout
- [ ] 3DS test flow succeeds and webhook confirms booking
- [ ] Closing browser mid-checkout leaves booking pending; retry reuses `authorizationUrl`
- [ ] Mobile: card flow from pay step reaches success screen
- [ ] Mobile: card flow from My Bookings detail sheet works
- [ ] M-Pesa flow still works after card changes (regression)

## Regression

- [ ] Onboarding gate still works
- [ ] Apple + email Bearer auth works
