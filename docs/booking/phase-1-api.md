# Phase 1 — Booking REST API

## Routes

| Method | Path | Service |
|--------|------|---------|
| GET | `/api/bookings/bootstrap` | `getBookingBootstrapData()` |
| GET | `/api/bookings/availability` | `getLocationAvailability()` |
| GET | `/api/bookings/quote` | `getBookingQuote()` |
| POST | `/api/bookings` | `createPendingBooking()` |
| GET | `/api/bookings/mine` | `listUserBookings()` |
| GET | `/api/bookings/[id]` | `getUserBookingById()` |

## Auth

- Bootstrap, availability, quote: public (no session required)
- Create, mine, detail: `getSessionWithBearerFallback` (cookie + Bearer)

## Rules

- `userId` on create comes from session — never from request body
- Reject create if `onboardingCompletedAt` is null (`ONBOARDING_INCOMPLETE`)
- Slot conflict → HTTP 409, code `SLOT_UNAVAILABLE`
- Zod validation → 400 `VALIDATION_ERROR`

## Files

- `src/app/api/bookings/**`
- `src/server/bookings/repository.ts` — `listUserBookings`, `getUserBookingById`
- `src/server/bookings/http.ts` — error mapping

## Exit criteria

- Bearer token can complete bootstrap → availability → quote → create → mine
