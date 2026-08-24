# Replay failure recovery

Use when one or more replay requests are in a failed terminal status.

## Check

1. Open the affected venue under **Admin → Venues**.
2. Review replay requests: status, `failureReason`, attempts, edge capacity.

## Diagnose

- Edge offline or buffer missing for the capture window.
- FFmpeg extraction or R2 upload failure.
- Wrong camera assignment or expired credentials.

## Recover

1. Restore venue edge health first (see `venue-edge-offline.md`).
2. Retry the replay request from the venue panel when status allows.
3. Cancel and recreate only when retries are exhausted or request is invalid.
4. Confirm private media upload completes and playback grant works.

## Verify

- Replay request reaches **ready**.
- Venue health dimension **Replay** returns to healthy.
- Player can play the clip from the replay surface.
