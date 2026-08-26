# PlayTT VenueEdge Installer Master Plan

**Status:** Implementation in progress
**Current phase:** Phase 2 — Multi-NVR edge runtime and camera failover  
**Last updated:** 2026-08-27
**Final deliverable:** A signed Windows `Setup.exe` that turns a supported venue PC into a securely paired, self-starting PlayTT VenueEdge Agent capable of selecting clips from configured cameras across multiple NVRs and uploading requested replays to private cloud storage.

## Purpose

This is the delivery tracker for productizing the existing VenueEdge replay service. It covers the cloud control plane, multi-NVR and multi-camera configuration, camera selection and failover, secure device pairing, local setup, Windows installation, updates, observability, and production certification.

Related source documents:

- [Replay edge architecture](./replay-edge.md)
- [Platform master build checklist](./master-build-checklist.md)
- [VIGI NVR pilot walkthrough](../hardware/vigi-nvr-pilot-walkthrough.md)
- [VenueEdge service README](../../services/venue-edge/README.md)
- [VenueEdge threat model and v2 rollback](../security/venue-edge-threat-model.md)

## How to maintain this tracker

- `[ ]` means implementation or its required evidence is outstanding.
- `[x]` means implementation, tests, documentation, and the stated exit evidence all exist.
- Mark a phase **Complete** only after every phase checkbox and exit gate is complete.
- Update the progress table and evidence ledger in the same change that completes work.
- Link tests, migration IDs, release artifacts, pilot reports, and rollback evidence rather than writing only “done.”
- If scope changes, record the decision in the decision log before changing the phase order.
- Do not store pairing codes, device secrets, NVR passwords, authenticated RTSP URLs, presigned upload URLs, or real venue network details in this file.

## Program outcome

An authorized venue administrator can:

1. Open PlayTT `/nvr` and select a venue.
2. Download a signed Windows installer and create a short-lived pairing code.
3. Install the VenueEdge Agent without installing Node.js, FFmpeg, Git, or repository dependencies manually.
4. Add one or more NVRs and test their connectivity.
5. Discover or manually add cameras/channels on each NVR.
6. Enable only the cameras PlayTT may use.
7. Map one or more approved cameras to each PlayTT table/resource.
8. Choose a primary camera, ordered fallbacks, and manual or automatic failover behavior.
9. Run a test capture and see the VenueEdge Agent become healthy.
10. Leave the agent running as a self-restarting Windows service after logout or reboot.
11. Request replays that upload only the requested clip to private cloud storage.
12. Reconfigure, update, diagnose, revoke, or replace the venue PC from an authorized management surface.

## Architecture boundary

```text
PlayTT player/app
    -> PlayTT cloud authorizes replay and creates command
        -> outbound HTTPS to/from VenueEdge Agent
            -> venue LAN NVR/camera source
            -> local rolling buffer or NVR playback extraction
            -> exact short-lived PUT grant to private object storage
        -> cloud verifies media and marks replay ready
```

The following are non-negotiable boundaries:

- Continuous RTSP video stays on the venue LAN.
- Only requested replay clips are uploaded.
- The cloud never requires an inbound connection to the venue PC or NVR.
- NVR RTSP ports are never exposed to the public internet.
- Replay authorization, tenant boundaries, media grants, and playback authorization remain cloud responsibilities.
- Capture, buffering, extraction, local recovery, and NVR credentials remain venue-edge responsibilities.

## Multi-NVR and camera-selection model

The target topology is:

```text
Venue
└── VenueEdge installation
    ├── NVR 1
    │   ├── Camera/channel 1 -> Table 1 primary
    │   ├── Camera/channel 2 -> disabled for PlayTT
    │   ├── Camera/channel 3 -> Table 1 fallback
    │   └── Camera/channel 4 -> Table 2 primary
    ├── NVR 2
    │   ├── Camera/channel 1 -> Table 2 fallback
    │   └── Camera/channel 2 -> Table 3 primary
    └── NVR 3
        └── Camera/channel 1 -> Table 1 emergency fallback
```

Each PlayTT resource has an ordered source policy:

- **Eligible sources:** Cameras explicitly approved for that resource. An edge may never select an unapproved camera.
- **Enabled state:** A camera can remain registered but be excluded from capture without deleting it.
- **Priority:** Lowest unique priority wins, for example `1 = primary`, `2 = first fallback`.
- **Selection mode:** `manual` pins an operator-selected source; `automatic` selects the highest-priority healthy source.
- **Fallback scope:** A fallback can live on the same NVR or a different NVR, but must be mapped to the same PlayTT resource.
- **Health inputs:** NVR reachability, authentication, channel availability, codec compatibility, clock skew, rolling-buffer freshness, recent extraction result, and local capacity.
- **Anti-flapping:** Switching and recovery use failure thresholds, a cooldown, and a sustained healthy window before optional failback.
- **Replay evidence:** Every replay records the selected source, policy/config version, attempted sources, and fallback reason.
- **Operator control:** An authorized operator can disable a failed camera, promote another camera, change priorities, or temporarily pin a source.

Default capture order for an automatic policy:

1. Primary camera rolling buffer.
2. Primary camera NVR playback fallback when allowed and healthy.
3. Next approved healthy camera rolling buffer.
4. That camera's NVR playback fallback.
5. Continue through the configured priority list.
6. Return a deterministic `no_healthy_source` failure when no approved candidate can serve the requested window.

## Target data ownership

| Concept                | Responsibility                                                                   | Secret handling                                                                  |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| VenueEdge installation | Cloud device identity plus local installation identity                           | Device secret hashed in cloud and protected locally                              |
| NVR connection         | Venue-scoped logical recorder and non-secret capabilities                        | NVR username/password protected locally; cloud stores an opaque secret reference |
| Camera source          | NVR channel/stream with label, codec, capability, and enabled state              | No credential duplication                                                        |
| Resource source policy | Ordered approved camera list, selection mode, active override, failover settings | No secrets                                                                       |
| Config snapshot        | Monotonic venue-wide desired configuration                                       | Signed/authenticated delivery; no plaintext NVR password                         |
| Source health          | Edge-reported current health and bounded operational history                     | URLs and credentials redacted                                                    |
| Replay source attempt  | Actual source chosen and failover trail for one replay request                   | No authenticated RTSP URL                                                        |

The database specialist's provisional normalized model is:

- `replay_recorders` — venue-scoped passive NVR inventory. NVRs do not authenticate as PlayTT devices.
- `replay_camera_sources` — recorder channels/stream profiles. Channel keys remain strings to support vendor formats.
- `replay_source_routes` — ordered resource-to-camera candidates. Priority `1` is primary; higher numbers are fallbacks.
- `venue_edge_secret_refs` — opaque metadata connecting an edge installation to local DPAPI/Credential Manager entries; never the NVR password.
- `venue_edge_config_revisions` — immutable, venue-scoped desired configuration snapshots.
- `venue_edge_config_applications` — per-installation apply/reject acknowledgement for a revision.
- `replay_source_health` — current queryable NVR/channel health projection; bounded heartbeat records remain time-series evidence.
- `replay_capture_attempts` — immutable source/mode attempts for each replay request.

Exact names may change during Phase 1 schema review. The important invariant is that the edge retains one venue-level device assignment with `resourceId = null`; per-resource routing belongs in normalized route records rather than one active device assignment per table.

## Program progress

| Phase                                                   | Status      | Current position                                                                                                                                                                                        |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 — Architecture, contracts, and data foundation  | Complete    | Signed off 2026-08-27: schema `0025`, config v2, rollout flags, transactional audit, backfill tooling, disposable rehearsal. P1-04 dispatch and P1-06 production cutover deferred to Phase 2 / staging ops |
| Phase 2 — Multi-NVR edge runtime and camera failover    | Not started | Depends on Phase 1 contracts (foundation complete)                                                                                                                                                        |
| Phase 3 — Pairing and secure installation identity      | Not started | Depends on Phase 1 installation model                                                                                                                                                                   |
| Phase 4 — Local setup and NVR configuration wizard      | Not started | Depends on Phases 2 and 3                                                                                                                                                                               |
| Phase 5 — Windows service and signed Setup.exe          | Not started | Depends on a stable local runtime and setup flow                                                                                                                                                        |
| Phase 6 — `/nvr` management and fleet experience        | Not started | Minimal pairing surface begins in Phase 3; full management follows installer                                                                                                                            |
| Phase 7 — Secure updates, diagnostics, and operations   | Not started | Depends on the signed installer pipeline                                                                                                                                                                |
| Phase 8 — Hardware certification and production rollout | Not started | Depends on all previous phase exits                                                                                                                                                                     |

---

# Phase 1 — Architecture, contracts, and data foundation

## Objective

Replace the singular “one edge device, one resource, one camera” assumption with versioned contracts and tenant-safe data capable of representing one venue PC, multiple NVRs, multiple cameras per NVR, and ordered source policies per PlayTT resource.

## Deliverables

### P1-01 — Freeze terminology and supported baseline

- [x] Define `VenueEdge Agent`, installation, NVR connection, camera source, resource source policy, candidate, primary, fallback, manual override, and active source.
- [x] Decide initially supported Windows versions and CPU architectures.
- [x] Record initially supported VIGI NVR models, firmware, codecs, and playback time modes.
- [x] Decide buffer, disk budget, clip window, health threshold, failover cooldown, and failback defaults.
- [x] Confirm that NVR credentials remain local-only unless a later reviewed envelope-encryption design is approved.
- [x] Record FFmpeg redistribution/license obligations and code-signing certificate requirements.

### P1-02 — Cloud schema and migration design

- [x] Keep the existing `devices` record as the authenticated edge host identity or document the reason for replacing it.
- [ ] Retain one location-scoped `venue_edge` assignment with `resourceId = null`; remove per-table edge routing from assignment JSON.
- [x] Add installation metadata: stable install ID, display name, platform, architecture, installed/current/desired version, update channel, last config applied, and lifecycle status.
- [x] Add venue-scoped NVR records with label, vendor, model, non-secret endpoint metadata, capability state, and opaque local secret reference.
- [x] Add camera-source records belonging to exactly one NVR, including channel, stream/profile, codec, label, enabled state, and discovery metadata.
- [x] Add one resource source policy per resource with `manual` or `automatic` selection mode.
- [x] Add ordered candidate records mapping approved cameras to a resource with unique priority and enabled state.
- [x] Add optional manual override with actor, reason, start, expiry, and audit metadata.
- [x] Add immutable monotonic venue config revisions and per-installation applied/rejected acknowledgement.
- [x] Add a queryable current source-health projection keyed by installation, recorder, and camera source.
- [x] Add immutable replay capture attempts and nullable config-revision/selected-source references on replay requests.
- [ ] Plan migration of existing singular `venue_edge` assignments without breaking current replay requests.
- [x] Enforce tenant and venue consistency through composite keys, constraints, and tested repository predicates.

### P1-03 — Edge config v2 contract

- [x] Define `GET /api/edge/v2/config` as a complete venue snapshot with installation, NVR, camera, resource policy, and candidate identifiers.
- [x] Exclude NVR passwords and authenticated RTSP URLs from cloud config.
- [x] Add config version, publication time, minimum agent version, and compatibility fields.
- [x] Define ETag or equivalent unchanged-config behavior.
- [x] Define transactional acknowledgement of the applied config version.
- [x] Define bounded v1 compatibility and an actionable minimum-version failure.
- [x] Freeze deterministic fixtures for one NVR/one camera, three NVRs/many cameras, disabled sources, manual override, and cross-NVR failover.

### P1-04 — Replay routing contract

- [ ] Keep replay commands resource-scoped and include the authorized policy/config version.
- [ ] Define edge response fields for actual source, selection reason, attempts, fallback transitions, and terminal failure.
- [ ] Persist the actual camera source and source-policy version on replay request/media evidence.
- [ ] Define behavior when the config changes while a replay is in progress.
- [ ] Define deterministic error codes including `no_source_configured`, `no_healthy_source`, `source_disabled`, `source_auth_failed`, `buffer_stale`, and `clock_skew`.

### P1-05 — Threat model and rollback design

- [x] Threat-model pairing, local setup UI, device auth, NVR secrets, config tampering, source-crossing, upload grants, diagnostics, and updates.
- [x] Define database and API rollback for v2 while v1 remains temporarily supported.
- [x] Define feature flags per tenant, venue, and resource.
- [x] Define audit events for topology changes, source selection, manual override, credential replacement, and device lifecycle.

### P1-06 — Additive migration and cutover sequence

- [x] Add normalized tables, enums, indexes, foreign keys, and nullable replay evidence columns without dropping v1 fields.
- [ ] Backfill existing camera and venue-edge assignments into recorder/source/route records using non-secret metadata only.
- [ ] Create unresolved local secret references where legacy configuration contained credentials; do not copy those secrets into new records.
- [ ] Publish a v1-equivalent initial config revision for every migrated venue.
- [ ] Dual-write topology changes and keep bounded v1 reads during agent migration.
- [ ] Cut replay dispatch and dashboard reads to config revisions, routes, capture attempts, and selected sources.
- [ ] Require local credential references, reject new password-bearing URLs/config JSON, and rotate or re-enter legacy credentials.
- [ ] Scrub legacy credential-bearing JSON only after the assigned agents acknowledge v2.
- [ ] Validate final constraints and retire obsolete v1 routing semantics after rollback criteria are satisfied.

## Required tests and evidence

- [x] Fresh-database and current-clone migrations converge.
- [x] One edge maps sources from at least three NVRs to multiple resources.
- [ ] A camera can be disabled without deleting its NVR or policy history.
- [x] Duplicate priority within one resource policy is rejected.
- [x] The same camera cannot accidentally serve an unrelated resource without an explicit mapping.
- [x] Cross-tenant and cross-venue references fail at service and database boundaries.
- [x] v2 fixtures pass producer/consumer contract tests.
- [x] Migration rollback/re-enable is rehearsed on disposable infrastructure.
- [ ] Replacing an edge PC preserves venue topology and routing but requires fresh local NVR credential entry.

## Phase 1 exit gate

- [x] Schema, API contracts, security decisions, migration plan, and v1 compatibility window are approved.
- [x] All Phase 1 automated evidence is linked in the evidence ledger.

**Sign-off (2026-08-27):** Phase 1 foundation accepted. Replay dispatch cutover (P1-04) and production migration/cutover (remaining P1-06) remain on the v1 path until Phase 2 runtime and staging apply `0025` + backfill.

---

# Phase 2 — Multi-NVR edge runtime and camera failover

## Objective

Teach the VenueEdge service to apply a venue-wide config, manage multiple NVRs and camera sources concurrently, select an approved source for each resource, and fail over predictably without cross-table video leakage.

## Deliverables

### P2-01 — Versioned local configuration

- [ ] Persist the last-known-good v2 config and applied version in local SQLite.
- [ ] Validate a new snapshot completely before activation.
- [ ] Apply config atomically and retain the prior snapshot for rollback.
- [ ] Hot-add, update, disable, and remove sources without restarting unrelated buffers.
- [ ] Continue safe operation from the last-known-good config during cloud outages.

### P2-02 — Multi-source runtime

- [ ] Replace the singular camera resolver with a registry keyed by camera source ID and resource ID.
- [ ] Run one bounded rolling-buffer supervisor per enabled source selected for buffering.
- [ ] Add CPU, memory, disk, network, and FFmpeg concurrency budgets.
- [ ] Isolate buffer paths, jobs, logs, and health by source ID.
- [ ] Restart only the failed or reconfigured source supervisor.

### P2-03 — Source health engine

- [ ] Track NVR reachability and authentication separately from channel/stream health.
- [ ] Track codec compatibility, buffer freshness, clock skew, recent probe, extraction, and upload results.
- [ ] Define `healthy`, `degraded`, `unhealthy`, `disabled`, and `unknown` states with reason codes.
- [ ] Add failure thresholds, cooldown, recovery threshold, and optional failback policy.
- [ ] Ensure one NVR outage marks its cameras appropriately without affecting cameras on other NVRs.

### P2-04 — Deterministic source selection and failover

- [ ] Implement manual pinned-source behavior.
- [ ] Implement automatic highest-priority healthy-source selection.
- [ ] Reject sources that are disabled, unhealthy beyond policy, not mapped to the resource, or from a stale config.
- [ ] Attempt rolling buffer before NVR playback according to the configured policy.
- [ ] Fail over across NVRs only through explicitly ordered candidates.
- [ ] Persist every source attempt and final selection locally and report it to the cloud.
- [ ] Prevent automatic failback from interrupting an in-progress replay.

### P2-05 — Simulator and recovery

- [ ] Extend fixtures to simulate multiple NVRs, channels, codecs, clock offsets, and independent failure modes.
- [ ] Recover active buffers and unfinished replay jobs after process restart.
- [ ] Bound queues and disk use under repeated source failure.
- [ ] Preserve command idempotency and immutable replay/media/object identities through failover.

## Required tests and evidence

- [ ] Primary source succeeds and no fallback is attempted.
- [ ] Failed primary uses the configured secondary on the same NVR.
- [ ] Failed NVR uses an approved camera on another NVR.
- [ ] Disabled camera is never selected.
- [ ] Manual pin prevents automatic switching until cleared or expired.
- [ ] No healthy approved camera yields `no_healthy_source` with the attempt trail.
- [ ] One table's camera failure does not affect another table.
- [ ] Restart, config rollback, disk pressure, and cloud outage recovery pass.
- [ ] Ten-resource capacity and isolation tests produce no source or media cross-talk.

## Phase 2 exit gate

- [ ] Multi-NVR selection and failover pass in the deterministic simulator.
- [ ] Local recovery and capacity behavior are measured and documented.

---

# Phase 3 — Pairing and secure installation identity

## Objective

Allow a generic VenueEdge installation to bind securely to one authorized PlayTT venue without terminal commands or manually copying long-lived credentials.

## Deliverables

### P3-01 — Pairing sessions

- [ ] Add an authenticated, `venue.manage`-gated pairing-session API.
- [ ] Generate a high-entropy, human-friendly, one-use code bound to tenant, venue, creator, and short expiry.
- [ ] Store only a hash of the pairing code.
- [ ] Use shared database/Redis rate limiting that works across application instances.
- [ ] Add cancel, expire, reissue, replace-host, and audit behavior.

### P3-02 — Installer enrollment exchange

- [ ] Generate a stable random installation ID locally; do not treat hostname or MAC address as authentication.
- [ ] Exchange pairing code, installation ID, platform, architecture, and agent version for device credentials.
- [ ] Make concurrent code consumption atomic with exactly one winner.
- [ ] Confirm pairing only after the first authenticated heartbeat and local initialization.
- [ ] Show `Waiting for install`, `Pending setup`, `Online`, `Expired`, and `Revoked` states.

### P3-03 — Local device-secret protection

- [ ] Store the PlayTT device secret through Windows DPAPI/Credential Manager under the service identity.
- [ ] Fail closed if protected storage is unavailable; never silently save plaintext.
- [ ] Add safe credential rotation with overlap, acknowledgement, and rollback.
- [ ] Add revoke and replacement-PC behavior.
- [ ] Redact pairing codes, device secrets, authorization headers, and upload URLs from logs and support bundles.

### P3-04 — Minimal `/nvr` onboarding surface

- [ ] Add an authorized venue selector and “Add VenueEdge” flow.
- [ ] Publish the correct signed installer artifact metadata or a development placeholder until Phase 5.
- [ ] Display pairing code, expiry, setup status, cancel, and reissue controls.
- [ ] Poll or stream pairing/heartbeat state without revealing device credentials.

## Required tests and evidence

- [ ] Expired, reused, cancelled, guessed, wrong-venue, and rate-limited codes fail safely.
- [ ] Concurrent enrollment produces one installation and one active credential.
- [ ] Browser, API logs, audit metadata, and telemetry contain no plaintext secret.
- [ ] Device revocation immediately blocks config, heartbeat, command, progress, and upload-grant APIs.
- [ ] Credential rotation survives agent restart and network interruption.

## Phase 3 exit gate

- [ ] A fresh unpackaged agent pairs with a venue through `/nvr`, stores credentials securely, and appears online without manual credential files.

---

# Phase 4 — Local setup and NVR configuration wizard

## Objective

Provide a guided local experience for adding multiple NVRs, choosing eligible cameras, mapping them to PlayTT resources, configuring failover, and proving capture readiness.

## Deliverables

### P4-01 — Hardened local setup host

- [ ] Build a small local setup application or loopback-only web UI that can run beside the service.
- [ ] Bind only to loopback and require a random, short-lived setup session token.
- [ ] Protect against CSRF, DNS rebinding, unauthorized local users, and stale setup links.
- [ ] Ensure closing the setup UI does not stop the VenueEdge service.

### P4-02 — NVR management

- [ ] Add, edit, rename, disable, and remove multiple NVR connections.
- [ ] Request NVR IP/host, port, vendor, dedicated least-privilege username, and password.
- [ ] Store credentials in protected local storage and expose only opaque secret references to cloud config.
- [ ] Test network reachability, authentication, live RTSP, recorded playback, time mode, clock skew, and codec.
- [ ] Support discovery where reliable and explicit manual entry as a fallback.

### P4-03 — Camera selection and mapping

- [ ] Enumerate or manually add channels/cameras for each NVR.
- [ ] Show camera label, NVR, channel, stream, codec, preview/test state, and health.
- [ ] Allow PlayTT capture to be enabled only for selected cameras.
- [ ] Map cameras to one or more explicitly authorized PlayTT resources when policy permits.
- [ ] Choose primary and drag/reorder fallback priority.
- [ ] Choose manual or automatic selection and configure failback behavior.
- [ ] Warn about duplicate, missing, unhealthy, or unrelated resource mappings.

### P4-04 — Commissioning test

- [ ] Test every enabled source individually.
- [ ] Perform a clock/wave test and display actionable skew remediation.
- [ ] Capture and locally preview a 15-second test clip.
- [ ] Test primary failure and fallback selection before declaring automatic policy ready.
- [ ] Publish redacted topology and health to the cloud.
- [ ] Require an explicit completion gate before enabling production replay capture.

## Required tests and evidence

- [ ] Fresh setup configures three NVRs and selects a subset of their cameras.
- [ ] Restart preserves protected credentials, topology, mappings, and policy.
- [ ] Bad credentials, unreachable NVR, unsupported codec, wrong channel, and clock skew show clear remediation.
- [ ] A user can promote a fallback after a camera failure without editing files or restarting unrelated sources.
- [ ] Setup UI security tests cover loopback binding, token expiry, CSRF, and DNS rebinding.

## Phase 4 exit gate

- [ ] A new PC can be paired and fully commissioned through guided UI with no terminal or plaintext configuration editing.

---

# Phase 5 — Windows service and signed Setup.exe

## Objective

Deliver a normal Windows installer that installs all required runtime components, starts VenueEdge automatically, survives reboot and failures, and can be repaired or removed safely.

## Deliverables

### P5-01 — Reproducible Windows bundle

- [ ] Bundle the compiled VenueEdge application, a pinned tested Node runtime, FFmpeg/ffprobe, setup UI, and service host.
- [ ] Install immutable binaries under `Program Files` and mutable state under `ProgramData`.
- [ ] Apply narrow ACLs to credentials, configuration, SQLite, buffers, pending clips, and logs.
- [ ] Embed product/version metadata and produce deterministic artifact hashes.
- [ ] Generate software-bill-of-materials and license notices.

### P5-02 — Windows service lifecycle

- [ ] Install a dedicated least-privilege service identity where feasible.
- [ ] Configure automatic delayed start and bounded crash restart.
- [ ] Handle stop, shutdown, reboot, network loss, NVR loss, and upgrade cleanly.
- [ ] Add log rotation, disk quotas, health endpoint, and Windows Event Log integration.
- [ ] Prevent venue laptop sleep/hibernation from silently breaking the service, or surface an actionable health warning.

### P5-03 — Installer experience

- [ ] Request elevation only for installation/service operations.
- [ ] Start the service and open pairing/setup after installation.
- [ ] Support install, repair, upgrade, uninstall, and reinstall.
- [ ] Define whether uninstall preserves local state and require explicit confirmation before destructive removal.
- [ ] Handle already-paired and replacement-machine scenarios safely.

### P5-04 — Signing and distribution

- [ ] Authenticode-sign installer and shipped executable binaries.
- [ ] Protect signing keys through approved certificate/HSM or CI signing service.
- [ ] Publish immutable versioned artifacts and SHA-256 metadata.
- [ ] Serve downloads over HTTPS from `/nvr` with channel and minimum-version metadata.
- [ ] Verify signature and hash during CI and installation acceptance.

## Required tests and evidence

- [ ] Clean supported Windows machine installs without Node, pnpm, Git, or FFmpeg already installed.
- [ ] VenueEdge starts after install, logout, reboot, network interruption, and recoverable crash.
- [ ] Pairing, three-NVR configuration, failover test, replay capture, and private upload succeed from the installed build.
- [ ] Repair preserves identity and protected configuration.
- [ ] Uninstall behavior matches the documented preservation/removal choice.
- [ ] Installer and binaries pass signature/hash verification and malware scanning.

## Phase 5 exit gate

- [ ] A signed release-candidate `Setup.exe` completes the full replay path on a clean Windows PC.

---

# Phase 6 — `/nvr` management and fleet experience

## Objective

Turn `/nvr` into the authorized cloud control plane for installations, topology, source policy, health, diagnostics, and operator recovery.

## Deliverables

### P6-01 — Fleet overview

- [ ] Show installations by venue with online/offline state, last heartbeat, installed/desired version, update channel, and commissioning state.
- [ ] Show NVR and camera counts, healthy/degraded/unhealthy sources, active overrides, disk pressure, buffer freshness, and replay backlog.
- [ ] Provide filters for venue, health, version, commissioning, and update state.

### P6-02 — Installation detail

- [ ] Show redacted NVR topology and per-camera/resource mappings.
- [ ] Show which source is currently primary or manually pinned for every resource.
- [ ] Show recent failovers, capture attempts, replay failures, and config application state.
- [ ] Provide guided actions for rename, reconfigure, test capture, disable/promote camera, clear override, rotate credentials, revoke, and replace PC.
- [ ] Require permission, reason, confirmation, and audit for high-impact actions.

### P6-03 — Safe remote desired configuration

- [ ] Validate every topology/policy change server-side before incrementing config version.
- [ ] Display desired, delivered, applied, and rejected config states.
- [ ] Allow rollback to a known-good configuration.
- [ ] Prevent secrets from being entered or returned through ordinary cloud JSON.
- [ ] Surface local-action-required instructions when an NVR credential must change.

### P6-04 — UX quality

- [ ] Make onboarding and common recovery usable without terminal knowledge.
- [ ] Provide clear loading, empty, partial, offline, stale, conflict, and error states.
- [ ] Meet responsive, keyboard, contrast, and screen-reader requirements.
- [ ] Use actionable language that identifies the exact venue, NVR, camera, and resource affected.

## Required tests and evidence

- [ ] Tenant and role boundaries protect every read and mutation.
- [ ] Topology changes are validated, audited, versioned, acknowledged, and rollbackable.
- [ ] Operator can disable a failed primary and promote a fallback while preserving other resources.
- [ ] No NVR password, authenticated RTSP URL, device secret, or upload grant renders in HTML, JSON, logs, analytics, or diagnostics.
- [ ] Browser E2E covers first install, online/offline recovery, manual switch, automatic failover display, revoke, and replace-host journeys.

## Phase 6 exit gate

- [ ] Venue staff can onboard and operate a small VenueEdge fleet through `/nvr` without direct database or filesystem access.

---

# Phase 7 — Secure updates, diagnostics, and operations

## Objective

Operate installed agents safely over time with signed updates, observable health, bounded diagnostics, rollback, and owned recovery procedures.

## Deliverables

### P7-01 — Signed update protocol

- [ ] Define a signed manifest with version, channel, minimum supported version, platform/architecture, artifact URL, SHA-256, signature, rollout cohort, and deadline.
- [ ] Download over HTTPS, verify signature and hash, stage atomically, restart, and health-check.
- [ ] Reject unsigned, tampered, wrong-platform, expired, and unauthorized downgrade artifacts.
- [ ] Restore the last-known-good application and configuration after a failed update.
- [ ] Resume interrupted updates safely.

### P7-02 — Fleet rollout controls

- [ ] Support pilot, stable, pinned, and emergency update states.
- [ ] Roll out through canary, venue cohort, percentage waves, and general release.
- [ ] Show current, desired, staged, successful, failed, and rolled-back update states in `/nvr`.
- [ ] Audit operator update, retry, pin, rollback, and channel changes.

### P7-03 — Observability and alerts

- [ ] Report edge uptime, version, config version, CPU/memory/disk, FFmpeg state, buffer age, queue depth, and upload health.
- [ ] Report per-NVR reachability/auth/time health and per-camera stream/buffer/capture health.
- [ ] Alert on edge offline, NVR offline, camera unhealthy, clock skew, stale buffer, disk pressure, replay backlog, repeated failover, update failure, and unsupported version.
- [ ] Propagate correlation ID from replay request through source attempts, extraction, upload, verification, and playback readiness.

### P7-04 — Diagnostics and recovery

- [ ] Generate a bounded support bundle with logs, versions, redacted topology, health, and recent failure codes.
- [ ] Aggressively redact credentials, authenticated URLs, tokens, grants, and player data.
- [ ] Write runbooks for edge offline, NVR replacement, camera failure, credential rotation, disk pressure, replay backlog, update rollback, and replacement PC.
- [ ] Test remote kill switch and safe booking/payment-only mode.

## Required tests and evidence

- [ ] Tampered update is rejected and audited.
- [ ] Failed canary automatically rolls back without losing identity/config.
- [ ] Offline edge catches up safely when it reconnects.
- [ ] Alerts identify the exact venue, installation, NVR, camera, and resource.
- [ ] Support-bundle secret scanning finds no protected values.
- [ ] Recovery runbooks are exercised by someone other than their author.

## Phase 7 exit gate

- [ ] Signed updates and operational recovery pass on a staged installed fleet with rollback evidence.

---

# Phase 8 — Hardware certification and production rollout

## Objective

Prove the complete installed system on real supported hardware, measure capacity and replay latency, rehearse failures, and release a production-ready installer progressively.

## Deliverables

### P8-01 — Single-venue pilot

- [ ] Commission one supported Windows venue PC and at least one validated VIGI NVR.
- [ ] Validate each chosen camera's live stream, playback, codec, clock, and 15-second clip.
- [ ] Complete authenticated replay request through private upload and authorized playback.
- [ ] Verify continuous video remains local and only requested clips appear in cloud storage.

### P8-02 — Multi-NVR failover certification

- [ ] Commission at least three NVRs with four or more cameras each where hardware permits.
- [ ] Select only an approved subset of cameras for PlayTT.
- [ ] Map primary and fallback cameras across NVRs for multiple resources.
- [ ] Disconnect a primary camera and verify configured fallback behavior.
- [ ] Disconnect one NVR and verify unaffected NVRs/resources continue operating.
- [ ] Restore the source and verify cooldown/failback behavior without flapping.
- [ ] Confirm the cloud shows the actual selected camera and failover reason.

### P8-03 — Scale, endurance, and recovery

- [ ] Run representative simultaneous replays across ten resources.
- [ ] Measure CPU, memory, disk, network, buffer freshness, extraction time, upload time, and ready latency.
- [ ] Run a sustained observation period with reboot, WAN loss, NVR loss, R2 outage, cloud deploy, and edge update scenarios.
- [ ] Rehearse device-secret rotation, NVR-password rotation, NVR replacement, and venue-PC replacement.
- [ ] Validate retention cleanup and recovery of pending clips after restart.

### P8-04 — Security and privacy sign-off

- [ ] Complete threat-model review and remediate critical/high findings.
- [ ] Verify tenant/resource/source isolation through API, database, command, upload, playback, and diagnostics paths.
- [ ] Verify installer/update signing, ACLs, DPAPI storage, redaction, rate limiting, and revocation.
- [ ] Approve replay privacy notice, retention, deletion, and venue camera-governance policy.

### P8-05 — Progressive release

- [ ] Release to internal/staging devices.
- [ ] Release to one pilot table with an operator present.
- [ ] Expand to selected resources at the first venue.
- [ ] Complete ten-resource certification and stable observation window.
- [ ] Complete second venue and replacement-PC pilot.
- [ ] Publish signed stable `Setup.exe`, hash, release notes, supported hardware matrix, install guide, and rollback instructions.

## Required tests and evidence

- [ ] Replay-ready latency targets are measured; initial targets remain p50 under 7 seconds and p95 under 15 seconds or are explicitly revised from evidence.
- [ ] Multi-resource and multi-tenant runs produce no camera/session/media cross-talk.
- [ ] One NVR, camera, edge process, WAN path, or update failure does not corrupt bookings, payments, sessions, or unrelated resources.
- [ ] On-call alert, diagnosis, recovery, and escalation exercises pass.
- [ ] Final release artifact installs and operates on every supported Windows profile.

## Phase 8 exit gate

- [ ] All phase evidence is linked, all critical/high risks are resolved, operational ownership is active, and the signed stable `Setup.exe` is approved for general venue installation.

---

## Cross-phase API inventory

Names are provisional until Phase 1 contract approval.

### Operator/session-authenticated

- `POST/GET/DELETE /api/operator/venue-edge/pairing-sessions`
- `GET/PATCH/DELETE /api/operator/venue-edge/installations/:id`
- `GET/POST/PATCH/DELETE /api/operator/venue-edge/nvrs`
- `GET/POST/PATCH/DELETE /api/operator/venue-edge/sources`
- `GET/PUT /api/operator/venue-edge/resources/:resourceId/source-policy`
- `POST /api/operator/venue-edge/sources/:id/test`
- `POST /api/operator/venue-edge/resources/:resourceId/capture-test`
- `POST /api/operator/venue-edge/installations/:id/diagnostics`
- `POST /api/operator/venue-edge/installations/:id/update-actions`

### Bootstrap/pairing

- `POST /api/edge/v1/enroll/exchange`
- `POST /api/edge/v1/enroll/confirm`

### Device-authenticated

- `GET /api/edge/v2/config`
- `POST /api/edge/v2/config/applications`
- Existing heartbeat, command, ACK, replay progress, and upload-grant routes with compatible v2 payload additions
- Update manifest and update-result routes to be finalized in Phase 7

## Global definition of done

The program is complete only when:

- [ ] One installed agent supports multiple NVRs and selected cameras per NVR.
- [ ] Every resource uses only explicitly approved camera sources.
- [ ] Manual switching and automatic priority failover are deterministic, visible, audited, and tested.
- [ ] A camera or NVR failure cannot leak another table's video into a replay.
- [ ] Pairing and setup require no terminal, source checkout, or manual credential file.
- [ ] The Windows service starts at boot, recovers after failure, and survives upgrade.
- [ ] Installer and updates are signed, verified, rollbackable, and fleet-observable.
- [ ] NVR passwords and PlayTT device secrets are protected locally and absent from ordinary cloud payloads/logs.
- [ ] Continuous video stays on the venue LAN; only authorized requested clips upload.
- [ ] Private upload, verification, playback, idempotency, isolation, and recovery pass on physical hardware.
- [ ] A clean supported PC can install the final stable `Setup.exe`, configure the venue, and deliver a playable cloud replay end to end.

## Evidence ledger

Add one row when a work package or phase exit is completed.

| Date       | Work package                                          | Status      | Owner | Change/PR                                                                                                                                          | Tests and reports                                                                                                    | Migration/release                                 | Rollback evidence                                         | Notes                                                                          |
| ---------- | ----------------------------------------------------- | ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-08-26 | Master implementation plan                            | Complete    | Codex | `docs/platform/venue-edge-installer-master-plan.md`                                                                                                | Plan review                                                                                                          | N/A                                               | N/A                                                       | Eight-phase delivery tracker established                                       |
| 2026-08-26 | P1 schema and config v2 foundation                    | Complete    | Codex | `db/schema.ts`, `src/app/api/edge/v2/config/route.ts`, `services/venue-edge/src/cloud/config-v2.ts`                                                | 48 focused tests: 46 passed, 2 database-dependent skipped; strict migration validation and focused TypeScript passed | `drizzle/0025_phase1_venue_edge_sources.sql`      | Additive migration keeps v1 fields and endpoint unchanged | Foundation superseded by close-out rehearsal row |
| 2026-08-27 | P1 publication, acknowledgement, and backfill tooling | Complete    | Codex | `src/server/replays/edge-config-v2-publication.ts`, `src/app/api/edge/v2/config/applications/route.ts`, `scripts/backfill-venue-edge-topology.mjs` | Canonical checksum, version compatibility, transaction/idempotency, redaction, consumer, and backfill tests          | Dry-run by default; apply is explicitly confirmed | v1 assignments and endpoint remain untouched              | Included in close-out rehearsal evidence |
| 2026-08-27 | P1 close-out: rollout flags, audit, rehearsal         | Complete    | Codex | `src/server/replays/feature-policy.ts`, `src/server/tenancy/audit-log-write.ts`, `scripts/integration/venue-edge-phase1-rehearsal.test.mjs`        | `pnpm test:db`, `pnpm test:db:venue-edge-rehearsal`, `feature-scope.test.mjs`, `venue-edge-phase1-closeout.test.mjs` | Disposable PostgreSQL only; app `POSTGRES_URL` not mutated | Disable `venue_edge_config_v2`; v1 assignments and `/api/edge/v1/*` unchanged | Rollback rehearsed via flag off/on with topology retained |
| 2026-08-27 | Phase 1 exit gate sign-off                            | Complete    | Owner | `docs/platform/venue-edge-installer-master-plan.md`                                                                                                 | `pnpm test:db`, `pnpm test:db:venue-edge-rehearsal`, `pnpm test:replay-edge`, `pnpm test:venue-edge`                 | `drizzle/0025_phase1_venue_edge_sources.sql`      | Disable `venue_edge_config_v2` for rollback                     | Phase 1 marked Complete; P1-04/P1-06 cutover deferred to Phase 2 |

## Decision log

| Date       | Decision                                                                           | Status   | Reason                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-08-26 | Product name is **PlayTT VenueEdge Agent**                                         | Accepted | Distinguishes the venue-local data plane from the cloud backend                                               |
| 2026-08-26 | One venue installation may manage multiple NVRs and camera sources                 | Accepted | Required for realistic venue layouts and scale                                                                |
| 2026-08-26 | Camera eligibility and ordered failover are configured per PlayTT resource         | Accepted | Prevents accidental cross-table selection and supports camera failure recovery                                |
| 2026-08-26 | Continuous RTSP remains local; only requested clips upload                         | Accepted | Preserves privacy, bandwidth, and security boundary                                                           |
| 2026-08-26 | Production runs as a self-starting Windows service installed by signed `Setup.exe` | Accepted | Removes terminal and logged-in-user dependency                                                                |
| 2026-08-26 | NVR credentials are local-only by default                                          | Accepted | Reduces cloud secret exposure and matches the local-only need                                                 |
| 2026-08-26 | Full implementation follows the eight phases in this tracker                       | Accepted | Keeps schema, runtime, identity, setup, packaging, fleet, operations, and certification dependencies explicit |
| 2026-08-27 | Phase 1 baseline: Windows 10 22H2+ and Windows 11 23H2+, x64 only for first signed installer | Accepted | ARM64 and Windows Server deferred |
| 2026-08-27 | Phase 1 baseline: TP-Link VIGI NVR1xxxH, H.264 main, Digest RTSP; no generic ONVIF in v1 | Accepted | Pilot walkthrough documents playback suffix `z`/`l` |
| 2026-08-27 | Phase 1 capture defaults: 12s+3s clip, 60–120s buffer, 3-failure failover, 60s cooldown, 120s healthy failback | Accepted | Disk byte budgets measured in Phase 2 |
| 2026-08-27 | Phase 1 FFmpeg: H.264 remux/stream-copy with LGPL-compatible build bundled in Phase 5 installer | Accepted | GPL transcode is explicit later compatibility path |
| 2026-08-27 | Phase 1 rollout: `replay_edge` + `venue_edge_config_v2` flags with optional venue/resource `scope` | Accepted | Rollback disables v2 while v1 capture continues |
| 2026-08-27 | One camera may serve multiple resources only via explicit `replay_source_routes` rows | Accepted | Schema invariant prevents accidental cross-table selection |
| 2026-08-27 | Non-secret NVR endpoint metadata may live in cloud; passwords never do | Accepted | Opaque `venue_edge_secret_refs` only |
| 2026-08-27 | Code signing and artifact hosting deferred to Phase 5 with requirement recorded | Accepted | Production `Setup.exe` blocked until signing pipeline exists |

## Open decisions

- [ ] Installer technology and service-wrapper version after prototype validation.
- [ ] Production artifact hosting and update rollout infrastructure (Phase 5/7).
- [ ] Final data-retention periods for local buffers, failed clips, source health, and diagnostics.
