# TTLock / access automation (Phase 5)

Software path for venue access, relays, and notifications. Physical keypad certification remains a separate exit gate.

## Feature flags

Enable per tenant through `feature_flags` or environment fallbacks:

| Flag | Env fallback | Purpose |
| --- | --- | --- |
| `live_access` | `LIVE_ACCESS_ENABLED=true` | Booking grants, player reveal APIs |
| `ttlock_provider` | `TTLOCK_PROVIDER_ENABLED=true` | Admin TTLock commissioning and inventory |
| `relay_automation` | `RELAY_AUTOMATION_ENABLED=true` | Session prepare/warn/end relay commands |
| `access_notifications` | `ACCESS_NOTIFICATIONS_ENABLED=true` | Push notifications for access/session/replay |
| `remote_unlock` | `REMOTE_UNLOCK_ENABLED=true` | Audited operator remote unlock |

Provider mode:

- `TTLOCK_PROVIDER_MODE=simulator` (default): deterministic simulator for development and CI
- `TTLOCK_PROVIDER_MODE=real`: live TTLock Open Platform V3 adapter
- `RELAY_PROVIDER_MODE=device`: enqueue relay commands through the device command bus; otherwise simulator

Required secrets:

- `PLAYTT_CREDENTIAL_KEYRING` — encrypts passcodes, TTLock tokens, and push tokens
- `PLAYTT_PASSCODE_FINGERPRINT_KEY` — fingerprints booking codes without storing plaintext
- `PLAYTT_REMOTE_UNLOCK_OTP_PEPPER` — hashes remote-unlock email OTP challenges

## Operator workflow (simulator)

1. Open `/admin/access` with `live_access` and `ttlock_provider` enabled.
2. Connect a TTLock account (password is exchanged for tokens and never stored).
3. **Sync inventory** on the connection.
4. Assign each lock to the correct access point.
5. Confirm a paid booking creates an access grant and reaches `ready` in **Credential recovery**.
6. Reveal the code only from the authenticated booking detail screen (web or mobile).

## Remote unlock incident flow

1. Enable `remote_unlock` after commissioning.
2. In `/admin/access`, choose the commissioned lock and enter a reason (10+ characters).
3. Click **Send email OTP** and enter the 6-digit code plus challenge ID.
4. Submit **Remote unlock**. Actions are rate limited (3 per 5 minutes) and audited.

## Booking modification

When `live_access` is on, applied booking modifications:

- update passcode validity on unchanged doors
- revoke obsolete doors and provision new doors after a resource change
- never roll back payment or booking confirmation

## Relay and notification automation

Session lifecycle transitions enqueue:

- `preparing` → table lights on + session reminder push
- `ending` → warning relay + five-minute warning push
- `completed` / `resetting` → lights off/reset + session ended push

Access-ready and access-failed pushes never include the door code. Payloads only carry `bookingId` for deep links.

## Failure recovery

| Symptom | Action |
| --- | --- |
| Grant stuck in `temporarily_unavailable` | Wait for worker retry or click **Retry** in admin |
| Partial door failure | **Reconcile**, then inspect credential counts |
| Cancelled booking still has access | Confirm worker ran; click **Revoke** if needed |
| TTLock token expired | Reconnect or sync inventory to refresh tokens |
| Guest cannot reveal code | Verify grant is `ready`, booking is paid, and user owns the booking |

## Rollback

Disable feature flags per tenant. Bookings and payments continue. Pending grants remain for reconciliation; use manual venue access until automation is re-enabled.

## Physical certification (out of software scope)

Before production `live_access`:

- Commission a real TTLock gateway and V4 custom-passcode lock
- Prove create/use/revoke on the physical keypad inside the configured window
- Run the two-venue, two-door scenarios in the Phase 5 exit checklist
