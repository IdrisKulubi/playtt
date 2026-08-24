# Single-table acceptance (Table 01)

Physical acceptance checklist for one configured table at the pilot venue.

## Journey

1. Player authenticates and books Table 01.
2. Payment confirms and creates one play session.
3. TTLock code opens required doors only during validity.
4. Resource prepares, ESP32 scores, and displays converge.
5. Replay becomes one private playable asset.
6. Session ends, access expires, resource resets, and the booking timeline is complete.

## Evidence to capture

- Booking ID and admin timeline screenshot.
- Device command and replay status from **Admin → Health**.
- Replay asset playback proof for the booking owner.
- Failure/rollback drill notes if any step fails.

## Software pre-checks

```bash
pnpm test:operations
pnpm ops:verify-env
pnpm ops:rehearse-dr
```

## Sign-off

Record venue, date, build SHA, operator, and reviewer in the rollout checklist.
