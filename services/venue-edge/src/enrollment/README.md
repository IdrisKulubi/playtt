# VenueEdge enrollment

P3-02 uses installer pairing codes and a random installation UUID — not hostname or MAC.

## Flow

1. Operator creates a pairing session in PlayTT admin and receives a one-time pairing code.
2. VenueEdge generates a random `installationUid` (`crypto.randomUUID()`).
3. VenueEdge calls `POST /api/edge/v1/enroll/exchange` with `pairingCode`, `installationUid`, `platform`, `architecture`, and `agentVersion`.
4. Cloud returns `{ deviceId, secret, credentialVersion, installationId, tenantId, locationId, status: "pending_setup" }`.
5. VenueEdge stores the device secret in Windows DPAPI (`credentials.dpapi`) under the service identity. Metadata without secrets lives in `installation.json`.
6. VenueEdge sends the first authenticated heartbeat to `POST /api/edge/v1/heartbeat`.
7. VenueEdge calls `POST /api/edge/v1/enroll/confirm` to move the device from `pending` to `active` (online).
8. All subsequent cloud calls use `Authorization: Device <deviceId> <secret>` against `/api/edge/v1/*`.

ESP32 enrollments continue to use `POST /api/device/v1/provision` with enrollment codes.

## Local storage (production)

Default paths under `{VENUE_EDGE_DATA_DIR}`:

- `credentials.dpapi` — DPAPI-protected blob containing only the device secret
- `installation.json` — `deviceId`, `credentialVersion`, optional `installationUid` (no secret)

Set `VENUE_EDGE_SECRET_STORE=memory` only for explicit non-production test runs. Production mode fails closed if DPAPI is unavailable.

Never commit credential files. Never log pairing codes, `secret`, RTSP passwords, or presigned upload URLs.

## Credential rotation

Cloud overlap rotation uses:

1. `POST /api/device/v1/credentials/rotate`
2. Persist new secret locally (DPAPI)
3. `POST /api/device/v1/credentials/acknowledge`
4. On persist failure: `POST /api/device/v1/credentials/rollback`

## Next steps

- P3-04: `/nvr` onboarding UI
- Automated first-boot enrollment CLI subcommand
