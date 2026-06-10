# Phase 6 — Booking edits (My Bookings)

## Scope

- Hide expired/cancelled bookings from My Bookings list
- Edit confirmed, paid, upcoming bookings from detail sheet
- Change time (same duration) with availability checks
- Add players only (no reductions)
- Reprice: charge delta via Paystack when total increases; lower total when cheaper with no payout

## Rules

- Editable when `confirmed` + `paid` + start is more than 2 hours away
- `POST /api/bookings/[id]/modifications/quote` — preview
- `POST /api/bookings/[id]/modifications/apply` — apply or start delta payment
- `GET /api/bookings/[id]/modifications/[modId]` — poll after pay

## Files

| Layer | Path |
|-------|------|
| Migration | `drizzle/0002_booking_edits.sql` |
| Domain | `src/server/bookings/modifications/` |
| Mobile edit | `playtt-mobile/app/(app)/booking/[id]/edit.tsx` |
| Mobile edit flow | `playtt-mobile/components/booking/booking-edit-flow.tsx` |

## Migration

```bash
pnpm db:migrate
```
