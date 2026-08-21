# @playtt/venue-edge

Venue-local PlayTT replay capture service (Phase 6 Stages 2–3–5–6).

One TypeScript Node.js process per venue. Talks to the PlayTT cloud over `/api/edge/v1/*`, maintains a rolling RTSP buffer (or deterministic simulator), extracts 12s + 3s replay clips, and uploads directly to private R2 via exact PUT grants.

## Modes

| `VENUE_EDGE_MODE` | Behavior |
| --- | --- |
| `simulate` | No FFmpeg. Deterministic fixture MP4, SQLite persistence, full progress protocol. |
| `buffer` | FFmpeg rolling buffer from `RTSP_URL` / edge config; 12+3 extraction. |
| `production` | Same as buffer; VIGI NVR fallback only when buffer missing and pilot flag set. |

## Quick start

```bash
cd services/venue-edge
pnpm install

# Simulator (no cloud credentials required for local unit tests)
pnpm simulate

# Production-style start (requires credentials + cloud)
VENUE_EDGE_CLOUD_BASE_URL=http://localhost:3000 \
VENUE_EDGE_DATA_DIR=.venue-edge-data \
pnpm start
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `VENUE_EDGE_MODE` | `simulate` | `simulate`, `buffer`, or `production` |
| `VENUE_EDGE_CLOUD_BASE_URL` | `http://localhost:3000` | PlayTT cloud base URL |
| `VENUE_EDGE_DATA_DIR` | `.venue-edge-data` | SQLite + clip storage root |
| `RTSP_URL` | — | Primary camera RTSP (buffer mode) |
| `VENUE_EDGE_CREDENTIALS_PATH` | `{dataDir}/credentials.json` | Device auth store |
| `VENUE_EDGE_ENCRYPT_CREDENTIALS` | `false` | AES-256-GCM at rest |
| `VENUE_EDGE_MAX_CONCURRENT` | `3` | Bounded replay concurrency (Stage 6) |

## Layout

```
{dataDir}/
  venue-edge.sqlite
  credentials.json
  buffers/{cameraId}/
  pending/{replayRequestId}/
  uploaded/
  failed/
```

## Tests

```bash
pnpm test
```

From repo root:

```bash
pnpm test:venue-edge
```

## Security

- Never logs camera passwords, device secrets, or presigned R2 URLs.
- Wrong `resourceId` commands are rejected locally after config check.
- VIGI NVR adapter is blocked in production until `VENUE_EDGE_ALLOW_VIGI_ADAPTER=true`.

## Related docs

- [Replay Edge Pipeline](../../docs/platform/replay-edge.md)
- [Enrollment flow](./src/enrollment/README.md)
