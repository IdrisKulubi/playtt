# Stuck play session recovery

Use when a play session remains non-terminal after its scheduled end window.

## Check

1. Open **Admin → Bookings** and locate sessions around the affected table/time.
2. Open the booking timeline at `/admin/bookings/[id]`.
3. Review session lifecycle events, worker outbox entries, and audit transitions.

## Diagnose

- Durable worker or lifecycle cron not running.
- Session transition rejected or stuck between states.
- Resource never received reset command.

## Recover

1. Confirm `/api/cron/durable-work` is scheduled in production (`vercel.json`).
2. Inspect durable work dead letters and replay if needed.
3. Use operator tools to advance or safely close the session per product policy.
4. Confirm the resource is available for the next booking.

## Verify

- Booking timeline shows terminal session states (`available` / completed path).
- Venue health dimension **Sessions** returns to healthy.
