# TTLock keypad acceptance (Phase 5)

Use this checklist after software certification passes (`pnpm certify:phase5`) and before enabling `live_access` for a venue.

## Preconditions

- [ ] Migrations `0022`–`0024` applied
- [ ] `PLAYTT_CREDENTIAL_KEYRING` and `PLAYTT_PASSCODE_FINGERPRINT_KEY` configured
- [ ] Separate TTLock Open Platform app for this environment (dev/staging/prod)
- [ ] V4 lock commissioned with gateway online in `/admin/access`
- [ ] Access points mapped to the correct locks

## Commissioning

1. Sync TTLock inventory for the venue connection.
2. Assign shared entrance and resource locks to the booking access points.
3. Set `TTLOCK_PROVIDER_MODE=real` only for the commissioning session.
4. Confirm a paid booking provisions credentials without operator intervention.

## Keypad window proof

Record booking id, passcode (operator reveal only), `validFrom`, and `validUntil`.

| Step | Expected result | Evidence |
| --- | --- | --- |
| Before `validFrom` | Keypad rejects passcode | Photo or operator note |
| Inside window | Keypad accepts passcode | Photo or operator note |
| After `validUntil` | Keypad rejects passcode | Photo or operator note |

## Modify and revoke on hardware

| Step | Expected result | Evidence |
| --- | --- | --- |
| Reschedule booking (time-only) | Old window invalid; new window works on keypad | Operator note |
| Cancel booking | Passcode rejected immediately | Operator note |
| Resource change | Obsolete door rejects; new door accepts same booking code | Operator note |

## Outage recovery

Follow [ttlock-access runbook](../runbooks/ttlock-access.md) for:

- Gateway disconnect and reconnect
- Token refresh after `authentication_refreshable`
- Partial multi-lock failure with operator retry/reconcile
- Protected remote unlock when passcode path is unavailable

## Sign-off

- [ ] Operator name and date recorded
- [ ] Venue / resource ids recorded
- [ ] Evidence attached to commissioning ticket
