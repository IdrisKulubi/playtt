# Phase 5 two-venue acceptance

Phase 5 cannot be marked **Complete** until shared-entrance and resource-door scenarios pass at **two venues**.

Software evidence: `pnpm certify:phase5` (simulator isolation) and `pnpm test:access`.

## Venue matrix

| Venue | Shared entrance lock | Resource lock | Commissioned |
| --- | --- | --- | --- |
| Hurlingham / Table 01 |  |  | [ ] |
| Second pilot venue |  |  | [ ] |

## Scenario A — one booking, two doors (same venue)

1. Create a paid booking on a resource with both shared entrance and resource door assigned.
2. Confirm one passcode is revealed to the player.
3. Entrance lock accepts the code inside the booking window.
4. Resource lock accepts the same code inside the booking window.

## Scenario B — unrelated venue isolation

1. Use the passcode from Scenario A on a lock at the second venue (or an unassigned lock).
2. Keypad must reject the code.

## Scenario C — modify and revoke across doors

1. Reschedule the booking; both doors honor the updated window.
2. Cancel the booking; both doors reject the code.

## Evidence to capture

- Booking id and both lock external ids per venue
- Timestamped keypad results (accept/reject)
- Operator who ran the scenario

## Sign-off

- [ ] Scenario A passed at venue 1
- [ ] Scenario A passed at venue 2
- [ ] Scenario B passed (cross-venue rejection)
- [ ] Scenario C passed at both venues
