# VenueEdge enrollment

An unpackaged agent pairs with a venue from a `/nvr` pairing code. Hostname and MAC are not used.

## Operator flow

1. Authorized operator opens PlayTT `/nvr`, selects a venue, and creates a pairing code.
2. On the venue PC:

```bash
cd services/venue-edge
VENUE_EDGE_CLOUD_BASE_URL=https://playtt.example \
pnpm enroll -- XXXX-XXXXXX
```

Or start with the code once:

```bash
VENUE_EDGE_PAIRING_CODE=XXXX-XXXXXX pnpm start
```

## Agent flow

1. Generate a random `installationUid` (`crypto.randomUUID()`), reused from `installation.json` if present.
2. Call `POST /api/edge/v1/enroll/exchange` with `pairingCode`, `installationUid`, `platform`, `architecture`, and `agentVersion`.
3. Persist the device secret through DPAPI (`credentials.dpapi`). Metadata without secrets lives in `installation.json`.
4. Send the first authenticated heartbeat to `POST /api/edge/v1/heartbeat`.
5. Call `POST /api/edge/v1/enroll/confirm`. The device becomes `active` / Online in `/nvr`.
6. Later cloud calls use `Authorization: Device <deviceId> <secret>` against `/api/edge/v1/*`.

ESP32 enrollments continue to use `POST /api/device/v1/provision`.

## Local storage (production)

Default paths under `{VENUE_EDGE_DATA_DIR}`:

- `credentials.dpapi` — DPAPI-protected blob containing only the device secret
- `installation.json` — `deviceId`, `credentialVersion`, optional `installationUid` (no secret)

Set `VENUE_EDGE_SECRET_STORE=dpapi` to persist pairing on Windows. Simulate and buffer default to in-memory secrets so `pnpm start` works without extra env. Production mode uses DPAPI and fails closed if it is unavailable.

Never commit credential files. Never log pairing codes, `secret`, RTSP passwords, or presigned upload URLs.

## Credential rotation

Cloud overlap rotation uses:

1. `POST /api/device/v1/credentials/rotate`
2. Persist new secret locally (DPAPI)
3. `POST /api/device/v1/credentials/acknowledge`
4. On persist failure: `POST /api/device/v1/credentials/rollback`
