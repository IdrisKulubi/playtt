# Device command failure recovery

Use when device commands remain in `failed` status for a venue.

## Check

1. Open **Admin → Devices** for the affected venue.
2. Review recent command history and `lastError` values.
3. Open the related booking timeline if the command was replay-related.

## Diagnose

- Device offline when command was dispatched.
- Command expired before delivery or acknowledgement.
- Payload or firmware rejected the command.

## Recover

1. Restore device connectivity (see `device-offline.md`).
2. Re-issue the command from the operator flow or replay retry panel.
3. Revoke and re-enroll the device if credentials are stale.

## Verify

- Failed command count returns to zero on **Admin → Health**.
- New commands reach `acknowledged` status.
