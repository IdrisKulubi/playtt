# VenueEdge enrollment (placeholder)

Phase 6 Stage 2 uses the existing Phase 3 device enrollment flow.

## Flow

1. Operator creates a `venue_edge` device in PlayTT admin and receives a one-time enrollment code.
2. VenueEdge calls `POST /api/device/v1/provision` with `enrollmentCode` and `hardwareUid`.
3. Cloud returns `{ deviceId, secret, credentialVersion }`.
4. VenueEdge stores credentials locally via `auth/credentials.ts` (plain JSON in dev, AES-256-GCM when `VENUE_EDGE_ENCRYPT_CREDENTIALS=true`).
5. All subsequent cloud calls use `Authorization: Device <deviceId> <secret>` against `/api/edge/v1/*`.

## Local credential file

Default path: `{VENUE_EDGE_DATA_DIR}/credentials.json`

```json
{
  "deviceId": "uuid",
  "secret": "device-secret",
  "credentialVersion": 1
}
```

Never commit credential files. Never log `secret`, RTSP passwords, or presigned upload URLs.

## Hardware UID

Use a stable machine identifier (e.g. hostname + MAC hash) for `hardwareUid` during provision.

## Next steps (Stage 3+)

- Automated first-boot enrollment CLI subcommand
- Credential rotation via cloud command
- OS keychain integration for production venues
