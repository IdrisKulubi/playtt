# Hosted replay kiosk end-to-end runbook

Use this checklist to validate the full tablet → VenueEdge → TV → email → library flow on the production domain (`https://www.theplaytt.com`).

## Prerequisites

1. **Database migrations** — `0021_replay_requests` applied on the hosted Postgres instance (`pnpm db:migrate` against production `POSTGRES_URL`).
2. **Feature flags** — For the live tenant, enable:
   - `replay_edge`
   - `private_media`
3. **R2** — Production R2 bucket, credentials in hosted env, CORS allows upload from VenueEdge.
4. **VIGI NVR** — H.264 main stream, RTSP reachable from the venue PC. Local probe should pass:
   ```bash
   pnpm probe:vigi
   ```
5. **Durable worker** — Cron or worker process running `run-durable-work` so `replay.ready.v1` consumers send email and realtime hints.

## Venue provisioning

1. **Venue edge device** — Register a `venue_edge` device for the tenant; assign it to Table 01 with role `venue_edge`.
2. **Camera config** — In the assignment config, store `cameraDeviceId` (and RTSP URL server-side for edge config pull).
3. **Replay capability** — Resource must have `replay` capability.
4. **VenueEdge on venue PC** — Configure and start:
   ```bash
   VENUE_EDGE_CLOUD_BASE_URL=https://www.theplaytt.com
   VENUE_EDGE_MODE=buffer
   VENUE_EDGE_DEVICE_ID=<device-uuid>
   VENUE_EDGE_DEVICE_SECRET=<secret>
   RTSP_URL=rtsp://<nvr-host>:554/...
   ```
5. Confirm edge heartbeat in operator devices view (device shows online).

## URLs per table

From **Operator → Venue → Resources**, copy links for each table:

| Surface | URL pattern |
| --- | --- |
| Replay tablet | `https://www.theplaytt.com/replay?resourceId=<uuid>` or `/replay/table-01` when `resources.code` is set |
| TV overlay | `https://www.theplaytt.com/pod/tv?resourceId=<uuid>` |
| Scoreboard (optional) | `https://www.theplaytt.com/pod/scoreboard?resourceId=<uuid>` |

Bookmark the replay URL on the table-side tablet in kiosk Chrome.

## Test session

1. Book and pay for a session on Table 01 (confirmed + paid booking in the current time window).
2. Add clip credits to the **session owner** account (operator tools or seed).
3. Open TV URL on the venue monitor — scoreboard or idle state visible.
4. Open replay kiosk URL on the tablet — should show **Replay** button and remaining credits.
5. Play a rally, then tap **Replay** on the tablet.

## Expected flow

| Step | What to verify |
| --- | --- |
| 1. Kiosk POST | Tablet shows “Capturing replay…”. One credit debited from owner. |
| 2. VenueEdge | Edge logs show `capture_replay` command, FFmpeg extract, R2 upload. |
| 3. TV | Within ~7–15s, replay overlay plays on `/pod/tv`. |
| 4. Email | Owner receives replay-ready email with link to `/replays/:id`. |
| 5. Web library | Same replay appears in owner Activity / `/replays/:id`. |
| 6. Mobile | With `EXPO_PUBLIC_LIVE_REPLAY_LIBRARY=true`, clip shows in Highlights. |
| 7. Kiosk success | Tablet shows “Clip saved — playing on TV”, returns to ready state. |

## Failure checks

| Symptom | Likely cause |
| --- | --- |
| “No session” on tablet | No active `play_sessions` row or booking outside time window |
| “No clip credits” | Owner `replay_credit_balances.balance` is 0 |
| “Replay capture is offline” | VenueEdge offline, no assignment, or device revoked |
| “A replay is already in progress” | Previous request not terminal; wait or fail stuck request |
| TV no overlay | SSE stream disconnected, or `replay.ready` consumer not running |
| Email missing | Durable worker down, or notification already sent for replay |
| 503 replay_edge / private_media | Feature flags off for tenant |

## Idempotency check

1. Tap Replay once; note `replayRequestId` in network tab.
2. Retry the same POST with the same `clientIdempotencyKey` (e.g. refresh during processing).
3. Expect same IDs, no additional credit debit.

## Rollback

- Disable `replay_edge` flag — kiosk shows “Replay capture is not enabled”.
- Existing in-flight requests continue until terminal state.
