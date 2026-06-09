# Booking API — Data Contracts

All endpoints return JSON. Errors: `{ code: string, message: string }`.

## `GET /api/bookings/bootstrap`

**Auth:** optional

```json
{
  "data": {
    "locations": [
      {
        "id": "uuid",
        "name": "PlayTT Hurlingham",
        "slug": "playtt-hurlingham",
        "timezone": "Africa/Nairobi",
        "address": "Hurlingham, Nairobi, Kenya",
        "resources": [
          {
            "id": "uuid",
            "locationId": "uuid",
            "name": "Hurlingham Main Pod",
            "slug": "hurlingham-main-pod",
            "type": "pod",
            "capacity": 2
          }
        ]
      }
    ]
  }
}
```

## `GET /api/bookings/availability`

**Query:** `locationId`, `date` (`yyyy-MM-dd`), `durationMinutes` (30|60), `groupSize` (2–8)

```json
{
  "data": {
    "slots": [
      {
        "startsAt": "2026-06-10T14:00:00.000Z",
        "endsAt": "2026-06-10T15:00:00.000Z",
        "durationMinutes": 60,
        "isAvailable": true,
        "openTableCount": 1,
        "availableResourceIds": ["uuid"],
        "price": {
          "currency": "KES",
          "subtotalAmount": 1600,
          "discountAmount": 0,
          "totalAmount": 1600,
          "pricingRuleSnapshot": {}
        }
      }
    ]
  }
}
```

## `GET /api/bookings/quote`

**Query:** `locationId`, `resourceId`, `startTimeIso`, `durationMinutes`, `groupSize`

## `POST /api/bookings`

**Auth:** required. `userId` from session only.

**Body:**

```json
{
  "locationId": "uuid",
  "resourceId": "uuid",
  "startTimeIso": "2026-06-10T14:00:00.000Z",
  "durationMinutes": 60,
  "groupSize": 4,
  "notes": "optional"
}
```

**Response:**

```json
{
  "data": {
    "bookingId": "uuid",
    "status": "pending",
    "paymentStatus": "unpaid",
    "totalAmount": "2100.00",
    "currency": "KES",
    "expiresAt": "2026-06-09T12:10:00.000Z"
  }
}
```

## `GET /api/bookings/mine`

**Auth:** required. **Query:** optional `filter=upcoming|past|all` (default `all`)

## `GET /api/bookings/:id`

**Auth:** required. Owner only.
