# VenueEdge threat model and v2 rollback

Status: Phase 1 baseline, 2026-08-27. Re-review before a production pilot and
after any change to pairing, local secret storage, update signing, or media grants.

## Protected assets and trust boundaries

Protected assets are NVR credentials, the PlayTT device secret, continuous video,
requested clips, tenant/resource routing, config revision integrity, exact-object
upload grants, update packages, and diagnostic bundles.

The cloud authorizes requests and publishes topology. The VenueEdge Agent holds
NVR credentials and continuous video on the venue LAN. Object storage accepts
only an authorized clip through a short-lived exact-object grant. No cloud
service opens an inbound connection to the venue PC or NVR.

## Threats and required controls

| Threat                              | Control and failure behavior                                                                                                                                               | Evidence/gate                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Pairing-code theft or replay        | Short TTL, one-time exchange, rate limiting, venue/tenant binding, explicit confirmation, and audit event. Consumed/expired codes fail closed.                             | Phase 3 pairing tests                                   |
| Device-secret theft                 | Hash in cloud; store under the Windows service identity using DPAPI/Credential Manager; redact headers/logs; support rotation and revocation.                              | Phase 3 secret-storage tests                            |
| NVR credential disclosure           | Credentials remain local-only. Config, backfill reports, fixtures, diagnostics, and audit metadata reject secret fields and credentialized URLs.                           | Config/backfill/secret-scan tests                       |
| Config tampering or downgrade       | Device-authenticated TLS, immutable monotonic revisions, canonical checksum, complete validation before atomic apply, last-known-good rollback, and minimum agent version. | Config v2 producer/consumer tests                       |
| Cross-tenant, venue, or table video | Composite database constraints plus tenant/location/device predicates. Runtime selection may use only enabled candidates explicitly mapped to the requested resource.      | Schema, fixture, and Phase 2 isolation tests            |
| Malicious manual override           | Authorized operator only; bounded reason/expiry; immutable audit event; override must reference an enabled candidate in the same policy.                                   | Phase 6 RBAC/audit tests                                |
| Forged replay command               | Authenticated device command, tenant/resource-scoped replay request, immutable config revision, expiry, and idempotency identity.                                          | Replay request/command tests                            |
| Upload-grant abuse                  | Exact object key, content constraints, short TTL, one logical media identity, post-upload verification, and no reusable cloud storage credential on edge.                  | Private-media tests                                     |
| Diagnostic data exfiltration        | Allowlist diagnostics, cap payloads, reject secret-like fields and embedded credentialized URLs, and require operator authorization.                                       | Config rejection diagnostic tests; Phase 7 bundle tests |
| Local setup UI exposure             | Loopback-only listener, short-lived setup session, CSRF/origin checks, no plaintext secret echo, and automatic shutdown/lock after setup.                                  | Phase 4 security tests                                  |
| Compromised update                  | Signed manifest and binaries, pinned release key, hash verification before install, staged rollout, downgrade prevention, and last-known-good rollback.                    | Phase 7 signing/update tests                            |
| Disk exhaustion or retained video   | Bounded per-source buffer, reserved free-space floor, oldest-first cleanup, encrypted/protected service directory, and explicit degraded health.                           | Phase 2 capacity/recovery tests                         |

## Audit event contract

The following actions must use the existing tenant-scoped `audit_logs` store.
Metadata is identifier/status-only and must never contain credentials, RTSP URLs,
pairing codes, authorization headers, upload grants, or raw diagnostic output.

- `venue_edge.installation.paired`, `.revoked`, `.replaced`
- `venue_edge.recorder.created`, `.updated`, `.credential_replaced`
- `venue_edge.source.enabled`, `.disabled`, `.health_changed`
- `venue_edge.route.created`, `.priority_changed`, `.removed`
- `venue_edge.override.started`, `.expired`, `.cleared`
- `venue_edge.config.published`, `.applied`, `.rejected`
- `venue_edge.replay.source_selected`, `.fallback`, `.failed`
- `venue_edge.update.started`, `.succeeded`, `.rolled_back`, `.failed`

## V2 rollback procedure

Rollback is additive and never begins by dropping normalized tables or deleting
v1 assignments.

1. Disable Config v2 publication and v2 replay dispatch for the affected scope.
2. Keep `/api/edge/v1/*` available and direct eligible legacy agents back to v1.
3. Stop publishing new revisions; retain published/superseded revisions and all
   application/capture evidence.
4. Preserve normalized topology and local NVR credentials. Do not copy local
   credentials back into cloud assignment JSON.
5. Drain, retry, or explicitly cancel in-flight replay requests according to the
   revision recorded on each request; never switch sources mid-request.
6. Verify v1 health, command delivery, capture, upload, and playback before
   declaring rollback complete.
7. Record actor, reason, affected tenant/venue/resources, revision, timestamps,
   and verification results in the audit log and incident record.

Rollback triggers include cross-resource selection, secret material in a cloud
payload/log, invalid revision acceptance, repeated apply rejection above the
rollout threshold, material replay failure regression, or an update-signature
failure. Credential exposure additionally requires credential/device-secret
rotation and incident response; merely switching back to v1 is insufficient.

## V1 retirement conditions

V1 remains available through at least 2026-12-31. Retirement requires all
assigned production agents to acknowledge a supported v2 revision, completion
of a 30-day rollback observation window, a successful rollback rehearsal,
credential rotation out of legacy JSON, and approval of the production pilot
evidence. Legacy secret-bearing JSON is scrubbed only after those conditions.
