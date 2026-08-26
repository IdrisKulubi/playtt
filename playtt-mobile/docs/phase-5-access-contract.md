# Phase 5 mobile access contract

The booking detail screen uses live, owner-authorized access data. Booking lists never receive or render a code.

## Status

`GET /api/bookings/:id/access`

```json
{
  "data": {
    "access": {
      "bookingId": "booking-fixture-1",
      "status": "ready",
      "doors": [
        {
          "accessPointId": "access-point-fixture-1",
          "name": "Main entrance",
          "kind": "door",
          "sortOrder": 0
        }
      ],
      "validFrom": "2026-08-26T10:55:00.000Z",
      "validUntil": "2026-08-26T12:05:00.000Z",
      "revealable": true,
      "supportMessage": null,
      "updatedAt": "2026-08-26T10:30:00.000Z"
    }
  }
}
```

Supported states are `configuring`, `ready`, `temporarily_unavailable`, `action_required`, `revoking`, `revoked`, `expired`, and `not_eligible`.

## Explicit reveal

`POST /api/bookings/:id/access/reveal` returns `{ "data": { "code", "validFrom", "validUntil" } }` with `Cache-Control: no-store`. The app keeps `code` only in component memory, clears it on refresh/background/unmount, and never logs or persists it.

## Push

- `GET/PATCH /api/user/notification-preferences` manages `accessReady`, `accessFailed`, `sessionReminder`, `sessionWarning`, `sessionEnded`, and `replayReady`.
- `POST/DELETE /api/user/push-tokens` registers or revokes the current Expo token.
- Notification data may contain `bookingId`; Expo Router opens `/(app)/booking/[id]`. Notification payloads never contain an entry code.
- The operating-system permission prompt appears only after the player taps **Enable push on this device**. Android creates the default notification channel first. A physical development/production build is required for remote push testing.
