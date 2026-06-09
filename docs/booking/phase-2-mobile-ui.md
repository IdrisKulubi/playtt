# Phase 2 — Mobile Booking UI

## Flow

1. **Choose venue** — `VenuePicker` (single Hurlingham OK for MVP)
2. **Pick a time** — date strip, 30/60 min, slot list
3. **Review booking** — group size, price, confirm

## Files

- `playtt-mobile/app/(app)/book.tsx`
- `playtt-mobile/lib/booking-api.ts`, `booking-types.ts`, `booking-utils.ts`
- `playtt-mobile/components/booking/*`

## Navigation

Home tab → **Book a session** → `/(app)/book`

## Errors

Use `toast.apiError()` — no raw status codes in UI.

## Exit criteria

Onboarded user creates `pending` booking and sees confirmation screen.
