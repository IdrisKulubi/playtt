# @playtt/venue-edge

Venue-local PlayTT replay capture service (Phase 6 Stages 2–3–5–6).

One TypeScript Node.js process per venue. Talks to the PlayTT cloud over `/api/edge/v1/*`, maintains a rolling RTSP buffer (or deterministic simulator), extracts 12s + 3s replay clips, and uploads directly to private R2 via exact PUT grants.

## Modes

| `VENUE_EDGE_MODE` | Behavior |
| --- | --- |
| `simulate` | No FFmpeg. Deterministic fixture MP4, SQLite persistence, full progress protocol. |
| `buffer` | FFmpeg rolling buffers from per-source RTSP mappings; 12+3 extraction. |
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
VENUE_EDGE_SECRET_STORE=memory \
pnpm start

# Guided local setup (loopback-only; also starts with `pnpm start` by default).
# Create a code at PlayTT /nvr, then enter it in this wizard; no credential file editing.
VENUE_EDGE_CLOUD_BASE_URL=http://localhost:3000 \
VENUE_EDGE_SECRET_STORE=memory \
pnpm setup

# Development fallback: pair directly from the command line.
pnpm enroll -- ABCD-EFGHJK
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `VENUE_EDGE_MODE` | `simulate` | `simulate`, `buffer`, or `production` |
| `VENUE_EDGE_CLOUD_BASE_URL` | `http://localhost:3000` | PlayTT cloud base URL |
| `VENUE_EDGE_DATA_DIR` | `.venue-edge-data` | SQLite + clip storage root |
| `RTSP_URL` | — | Legacy single-source RTSP URL; accepted only when exactly one buffering source exists |
| `VENUE_EDGE_SOURCE_RTSP_URLS_JSON` | `{}` | Optional override map of source UUID to RTSP URL; local setup NVR store is preferred |
| `VENUE_EDGE_CREDENTIALS_PATH` | `{dataDir}/credentials.json` | Legacy plaintext path (removed on startup) |
| `VENUE_EDGE_INSTALLATION_PATH` | `{dataDir}/installation.json` | Non-secret installation metadata |
| `VENUE_EDGE_SECRET_BLOB_PATH` | `{dataDir}/credentials.dpapi` | DPAPI-protected device secret blob |
| `VENUE_EDGE_SECRET_STORE` | unset | `memory` for explicit test runs; production uses DPAPI |
| `VENUE_EDGE_PAIRING_CODE` | — | One-time `/nvr` pairing code for first-boot enrollment |
| `VENUE_EDGE_SETUP_PORT` | `18764` | Loopback setup wizard HTTP port |
| `VENUE_EDGE_SETUP_SESSION_TTL_MS` | `900000` | Setup session token TTL (15 minutes) |
| `VENUE_EDGE_SETUP_ON_START` | `true` | Start loopback setup host alongside `pnpm start` |
| `VENUE_EDGE_MAX_CONCURRENT` | `3` | Bounded replay concurrency (Stage 6) |
| `VENUE_EDGE_MAX_BUFFER_PROCESSES` | `8` | Maximum concurrent FFmpeg rolling buffers |
| `VENUE_EDGE_MAX_CPU_PERCENT` | `85` | Windows system CPU admission ceiling for new buffers |
| `VENUE_EDGE_MAX_NETWORK_MBPS` | `100` | Estimated aggregate ingress admission ceiling |
| `VENUE_EDGE_ESTIMATED_SOURCE_NETWORK_MBPS` | `8` | Estimated ingress bandwidth reserved per source |
| `VENUE_EDGE_INSTALL_LAYOUT` | unset | `installed` when running from the Windows service installer |
| `VENUE_EDGE_INSTALL_ROOT` | unset | Program Files install root; defaults when layout is installed |
| `FFMPEG_PATH` | unset | Overrides bundled `ffmpeg/ffmpeg.exe` under the install root |

## Windows installer (Phase 5)

Unsigned release-candidate packaging lives under `packaging/`. Production installs use:

- **Binaries:** `C:\Program Files\PlayTT\VenueEdge\` (Node 22, FFmpeg LGPL, bundled app, WinSW service)
- **State:** `C:\ProgramData\PlayTT\VenueEdge\` (SQLite, buffers, DPAPI secrets, logs)

Build the application bundle:

```bash
pnpm build          # dist/index.js via esbuild
pnpm pack:dry-run   # CI-friendly compile + layout checks (no Windows downloads)
```

On a Windows build host with Inno Setup 6:

```powershell
.\packaging\pack.ps1
```

This stages SHA-256-pinned Node, FFmpeg, and WinSW binaries, generates an SPDX SBOM and `SHA256SUMS`, signs and verifies every shipped executable, and compiles `PlayTTVenueEdge-Setup-<version>.exe`. Release packaging fails unless `VENUE_EDGE_SIGNING_CERT` identifies an installed code-signing certificate and `signtool.exe` is available. For local bundle testing only, use `-AllowUnsignedDevelopment -SkipSetupExe`; unsigned output is explicitly marked as development output.

**Uninstall:** Program Files are removed by default. Local pairing, NVR passwords, and topology in ProgramData are **preserved** unless the uninstaller “Remove local data” task is selected.

**Upgrade / repair:** Reinstalls binaries and the service without wiping ProgramData identity or secrets.

## Layout

```
{dataDir}/
  venue-edge.sqlite
  installation.json
  credentials.dpapi
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
- Commands whose `configRevisionId` differs from the locally applied revision are rejected.
- Missing source RTSP mappings fail closed outside simulator mode.
- VIGI NVR adapter is blocked in production until `VENUE_EDGE_ALLOW_VIGI_ADAPTER=true`.

## Related docs

- [Replay Edge Pipeline](../../docs/platform/replay-edge.md)
- [Enrollment flow](./src/enrollment/README.md)
