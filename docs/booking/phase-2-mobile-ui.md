# Phase 2 — Mobile Booking UI

## Flow (current)

1. **When** — timing screen (venue chip, dates, duration, slots). Single venue auto-skips location step.
2. **Players** — bottom sheet after slot tap (default 2 players).
3. **Confirm** — sticky bar + confirm sheet ("Book this slot").
4. **Done** — confirmation screen.

Target: ~3 taps for returning users. Full UX spec: [`playtt-mobile/docs/design-system/booking-ux.md`](../../playtt-mobile/docs/design-system/booking-ux.md).

## Files

- `playtt-mobile/app/(app)/book.tsx`
- `playtt-mobile/lib/booking-api.ts`, `booking-types.ts`, `booking-utils.ts`
- `playtt-mobile/components/booking/booking-flow.tsx` — orchestrator
- `playtt-mobile/components/booking/timing-panel.tsx`
- `playtt-mobile/components/booking/group-size-sheet.tsx`
- `playtt-mobile/components/booking/booking-checkout-bar.tsx`
- `playtt-mobile/components/booking/booking-confirm-sheet.tsx`
- `playtt-mobile/components/booking/booking-progress.tsx`
- `playtt-mobile/components/ui/bottom-sheet.tsx`

## Navigation

Home tab → **Book a session** → `/(app)/book`

## Copy standards

| Context | Copy |
|---------|------|
| Timing headline | When do you want to play? |
| Group sheet | How many of you? |
| Primary CTA | Book this slot |
| Success | You're booked! |
| Pending status | Your table is held. We'll confirm soon. |

## Errors

Use `toast.apiError()` — no raw status codes in UI. Slot conflict (409): friendly toast + refresh slots.

## Exit criteria

Onboarded user creates `pending` booking and sees confirmation screen.
