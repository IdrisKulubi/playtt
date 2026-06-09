# Phase 3 — My Bookings

## Screens

- **Bookings tab** — `app/(app)/(tabs)/bookings.tsx` (replaces Explore)
- **Detail** — `app/(app)/booking/[id].tsx`
- **Home** — upcoming card + Book CTA

## Status copy (v1, no payment)

| Status | Message |
|--------|---------|
| pending + unpaid | Reserved — payment coming soon. We'll confirm your slot. |
| confirmed | Confirmed — see you at the pod |
| cancelled / expired | Terminal state with clear label |

## API

- `GET /api/bookings/mine?filter=upcoming`
- `GET /api/bookings/:id`

## Exit criteria

Booking from Phase 2 appears in list and detail without rebooking.
