# Venue edge offline recovery

Use when the venue edge device is offline, unknown, or replay queue is at capacity.

## Check

1. Open the venue detail page under **Admin → Venues**.
2. Review edge heartbeat, replay queue depth, and replay request panel.

## Diagnose

- Venue edge process stopped on the venue PC.
- RTSP/camera path unreachable from the edge host.
- FFmpeg stuck or upload queue saturated.

## Recover

1. Restart the venue edge service on the venue PC.
2. Confirm RTSP probe succeeds (`pnpm probe:vigi` from operator docs).
3. Clear or retry stuck replay requests from the venue panel.
4. Follow the hosted replay kiosk runbook for full end-to-end validation: [hosted-replay-kiosk-runbook.md](../../hardware/hosted-replay-kiosk-runbook.md)

## Verify

- Edge heartbeat is recent in **Admin → Devices**.
- Venue health dimension **Venue edge** returns to healthy.
- A test replay reaches **ready** status.
