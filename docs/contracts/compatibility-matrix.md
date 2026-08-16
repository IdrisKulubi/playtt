# Compatibility matrix

Clients must tolerate unknown enum values from the API without throwing. Unknown
values render through `formatUnknownEnumValue()` (underscores become spaces).

## Booking status (`booking_status`)

| Value | Web label | Mobile label |
| --- | --- | --- |
| `pending` | Payment needed (when unpaid) | Complete M-Pesa payment… |
| `confirmed` | Confirmed | Confirmed — see you at the pod |
| `cancelled` | Cancelled | Cancelled |
| `expired` | Expired | Expired |
| `completed` | Completed | Completed |
| `failed` | `failed` → "failed" | same fallback |
| Unknown | Humanized raw value | Humanized raw value |

Implementation:

- Web: `src/components/bookings/booking-utils.ts`
- Mobile: `playtt-mobile/lib/booking-utils.ts`

## Payment status (`payment_status`)

| Value | Label |
| --- | --- |
| `paid` | Paid |
| `unpaid` | Unpaid |
| Unknown | Humanized raw value |

## Replay status (`replay_status`)

| Value | Label |
| --- | --- |
| `ready` | Ready |
| `processing` | Processing |
| `pending` | Pending |
| `failed` | Failed |
| `cancelled` | Cancelled |
| Unknown | Humanized raw value |

Implementation: `src/lib/compatibility/replay-status.ts`

## Capability / event values

Additive JSON fields (`pricingRuleSnapshot`, `metadata`, `additiveFields` in
mobile API v1) must be ignored when unrecognized. Clients must not branch on
unknown object keys for required UI.

Automated coverage: `src/lib/compatibility/*.test.mjs`
