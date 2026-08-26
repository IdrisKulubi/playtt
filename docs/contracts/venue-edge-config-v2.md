# VenueEdge configuration protocol v2

## Status

Phase 1 additive contract. Edge v1 remains available during the migration window.

Canonical fixtures live in `services/venue-edge/fixtures/edge-v2-*.json`. The cloud validator is `src/server/replays/edge-config-v2.ts`; the independent edge consumer parser is `services/venue-edge/src/cloud/config-v2.ts`.

## Endpoint

```http
GET /api/edge/v2/config
Authorization: Device <deviceId> <secret>
X-PlayTT-Edge-Agent-Version: 0.2.0
```

The response body is:

```json
{
  "data": {
    "protocolVersion": "edge-v2",
    "configRevision": {
      "id": "uuid",
      "version": 1,
      "checksum": "sha256:<64 lowercase hexadecimal characters>",
      "publishedAt": "2026-08-26T09:00:00.000Z"
    },
    "installation": {
      "id": "uuid",
      "deviceId": "uuid",
      "tenantId": "uuid",
      "venueId": "uuid",
      "minimumAgentVersion": "0.2.0"
    },
    "resources": [],
    "recorders": [],
    "sources": [],
    "resourcePolicies": []
  }
}
```

The response ETag contains both the revision version and topology checksum. A
newly published revision is therefore returned even when it intentionally has
the same topology as its predecessor.

## Recorder and source shape

An NVR is a passive recorder inventory record, not an independently authenticating PlayTT device.

```json
{
  "id": "recorder uuid",
  "label": "North NVR",
  "vendor": "vigi",
  "enabled": true,
  "connection": {
    "host": "192.168.10.20",
    "rtspPort": 554
  },
  "localConnectionKey": "windows-dpapi:nvr-north"
}
```

`localConnectionKey` is an opaque lookup key. It is not a credential and cannot be resolved outside the assigned venue PC. Passwords, tokens, authenticated URLs, and cloud-recoverable NVR secrets are forbidden.

A camera source is one recorder channel and stream profile:

```json
{
  "id": "source uuid",
  "recorderId": "recorder uuid",
  "label": "Table 1 overhead",
  "channelKey": "1",
  "streamProfile": "main",
  "codec": "h264",
  "enabled": true
}
```

`channelKey` is a string because recorder vendors may use non-numeric channel identities.

## Resource selection policy

Each enabled PlayTT resource has exactly one policy and exactly one priority-1 candidate.

```json
{
  "resourceId": "resource uuid",
  "selectionMode": "automatic",
  "manualSourceId": null,
  "failover": {
    "failureThreshold": 3,
    "cooldownSeconds": 30,
    "healthyThreshold": 2,
    "autoFailback": true
  },
  "candidates": [
    {
      "sourceId": "primary source uuid",
      "priority": 1,
      "captureModes": ["edge_buffer", "nvr_playback"]
    },
    {
      "sourceId": "fallback source uuid",
      "priority": 2,
      "captureModes": ["nvr_playback"]
    }
  ]
}
```

Rules:

- Candidate source IDs and priorities are unique within a resource.
- Only enabled sources belonging to enabled recorders may be candidates.
- A source can be selected only for resources whose policy explicitly lists it.
- Candidate priority is evaluated from the lowest number upward.
- Capture modes are ordered for one camera; for example, try its rolling buffer before its NVR playback.
- `automatic` requires `manualSourceId: null`.
- `manual` requires `manualSourceId` to reference an enabled candidate in the same policy.
- Failover never selects an undeclared camera, even when that camera is healthy.
- A config change never interrupts a replay already executing against a prior accepted revision.

## Revision and application behavior

- Revisions are immutable and monotonically versioned per venue.
- Cloud publication changes the previous published revision to superseded in the same transaction.
- The edge validates the entire snapshot before persisting or applying it.
- An invalid snapshot is rejected as a whole; the edge continues using its last-known-good revision.
- Edge application acknowledgement records the device, boot, revision, result, and redacted error.
- Replay requests and capture attempts retain the revision and actual selected source used for evidence.

Publication is serialized per tenant and venue. The cloud assigns the next
monotonic version, canonicalizes the topology, calculates its SHA-256 checksum,
validates the complete secret-free contract, and only then supersedes the prior
revision and inserts the new published revision in one transaction.

After atomically accepting or rejecting a snapshot, the agent acknowledges it:

```http
POST /api/edge/v2/config/applications
Authorization: Device <deviceId> <secret>
X-PlayTT-Edge-Agent-Version: 0.2.0
Content-Type: application/json

{
  "installationId": "uuid",
  "configRevisionId": "uuid",
  "status": "applied",
  "bootId": "agent boot identifier"
}
```

A rejected acknowledgement uses `status: "rejected"`, requires a bounded
`errorCode`, and may include up to 16 KiB of secret-free diagnostic details.
Credentialized URLs and secret-bearing fields are rejected. A terminal result
is idempotent when repeated and cannot later be changed to the opposite result.

## Legacy topology backfill

`pnpm db:backfill-venue-edge` performs a read-only dry run. It maps only
tenant/location-consistent active v1 VenueEdge assignments and reports skipped
rows without printing their configuration. It copies allowlisted non-secret
host, port, channel, and stream metadata only; authenticated RTSP paths and
credentials are discarded. Each eligible recorder receives an opaque
`reauth_required` local credential reference.

After reviewing the dry-run report, the explicitly gated
`pnpm db:backfill-venue-edge:apply` inserts deterministic, rerunnable topology
records. It never updates or deletes v1 assignments and never publishes a v2
revision. Local credentials must be entered and the topology reviewed before
publication.

## Security invariants

The config is rejected when it contains:

- A key containing `password`, `secret`, `token`, `credential`, `authorization`, or API/private-key variants.
- A URL containing username/password user information.
- Secret-bearing query parameters.
- An NVR host containing a URL scheme, path, or user information.
- A resource belonging to a different tenant or venue.
- An unknown recorder, source, or resource reference.
- A disabled source used as a route candidate.
- Duplicate IDs, source candidates, or priorities.
- An enabled resource without one priority-1 candidate.

Configuration authentication does not replace local validation. The VenueEdge Agent treats every cloud response as untrusted input until the edge-side parser and transactional apply checks pass.

## Compatibility

- `/api/edge/v1/config` and the singular assignment model remain unchanged through at least 2026-12-31. Retirement additionally requires every assigned production agent to acknowledge v2 and a 30-day rollback observation window to complete.
- A v2-capable agent calls `/api/edge/v2/config` and keeps the last-known-good v2 revision when temporarily offline.
- Config v2 requires `X-PlayTT-Edge-Agent-Version`. A missing, malformed, or older-than-minimum version receives HTTP 426 with `AGENT_VERSION_REQUIRED` or `AGENT_UPGRADE_REQUIRED` and an actionable minimum version.
- Cloud rollout remains feature-flagged by tenant, venue, and resource.
- V1 credential-bearing assignment JSON must be rotated into local protected storage before legacy data is scrubbed.
- V1 retirement requires a rehearsed rollback decision and cannot occur before the compatibility conditions above are satisfied.
