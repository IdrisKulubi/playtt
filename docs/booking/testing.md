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

## Regression

- [ ] Onboarding gate still works
- [ ] Apple + email Bearer auth works
