# PlayTT Master Build Checklist

## Purpose

This is the single follow-up checklist for building the complete PlayTT platform. It includes existing features, planned features, the order in which they must be built, and the evidence required before any item or phase may be marked complete.

Use this document for delivery tracking. Use the supporting documents for deeper technical detail:

- [Implementation blueprint](./implementation.md)
- [Delivery phases](./phases.md)
- [Build and test playbook](./phase-build-and-test.md)

## How to use the checklist

- `[x]` means the feature is implemented and the stated local evidence exists.
- `[ ]` means work or acceptance evidence is still outstanding.
- A phase is complete only when every feature and every phase exit checkbox is checked.
- Do not mark an item complete because code exists. Its tests, security checks, failure behavior, documentation, and rollout evidence must also pass.
- Add the owner, ticket/PR, feature flag, migration, test report, deployment, and rollback evidence to the delivery record for every work package.
- Hardware/provider items require simulator tests and physical staging evidence.



## Program progress


| Phase                                | Status      | Current position                                                                          |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| Phase 0 — Stabilization              | Complete    | Repository and live-environment evidence complete; Phase 1 may begin after owner sign-off |
| Phase 1 — Tenant/resource foundation | In progress | P1-01–P1-08 landed locally; Phase 1 exit gates remain                                     |
| Phase 2 — Sessions/durable events    | In progress | P2-01 through P2-07 implemented; repaired clone/DB acceptance must pass in hosted CI      |
| Phase 3 — Devices/scoring/realtime   | In progress | P3-01–P3-08 landed locally; hosted acceptance remains                                     |
| Phase 4 — Private R2 media           | In progress | P4-01–P4-06 landed locally; hosted R2 staging acceptance remains                         |
| Phase 5 — TTLock/automation          | Not started | Depends on access-point catalog, sessions, and device commands                            |
| Phase 6 — Replay edge                | Not started | Depends on devices and private media                                                      |
| Phase 7 — Operations/scale           | Not started | Depends on TTLock and replay-edge completion                                              |




## Current product baseline

These features exist today, but remain covered by Phase 0 regression and production-certification gates.

### Player identity and account

- [x] Email/password sign-up and sign-in exist.
- [x] Email OTP verification and password reset exist.
- [x] Google and Apple authentication paths exist.
- [x] Web sessions and mobile bearer-session fallback exist.
- [x] Two-factor authentication support exists.
- [x] Player onboarding, profile, security, and preferences screens exist.
- [x] User API responses share a tested mobile-compatible profile projection.
- [x] All authentication journeys pass browser and physical-device E2E tests.
- [x] Production provider credentials, callback URLs, and sender domains are smoke-tested.



### Booking and payment

- [x] Venue/resource bootstrap, availability, quote, and server-side pricing exist.
- [x] Pending booking holds and overlap protection exist.
- [x] Booking list, detail, edit, modification payment, and unpaid cancellation exist.
- [x] Paystack hosted checkout, callback verification, webhook confirmation, and payment status polling exist.
- [x] Booking confirmation email exists.
- [x] Payment, expiry, cancellation, modification, replay-pack, and Coach confirmation paths have conditional/idempotent application logic.
- [x] Paystack raw-body HMAC verification has an isolated constant-time security test suite.
- [x] The complete booking-to-payment journey passes production-like E2E with Paystack test mode and a disposable database.



### Player experience

- [x] Marketing, booking, dashboard, bookings, activity, account, and help surfaces exist.
- [x] Expo mobile authentication, onboarding, booking, checkout-return, account, activity, and Coach preview surfaces exist.
- [x] Replay credits and Coach subscription/insight/training APIs exist.
- [ ] Community data is real; the current community surface is preview/mock data.
- [ ] Notification preferences are server-backed; current browser preferences are local-only.
- [ ] Push notifications are implemented and production-certified.
- [ ] Replay capture uses real private media; the current automatic replay path is a development-only stub.
- [ ] Live access codes replace preview access data.



### Platform safety already implemented

- [x] Mobile API v1 freezes 23 supported endpoints with deterministic fixtures.
- [x] User, Replay, and Coach unexpected errors return stable non-sensitive envelopes.
- [x] Production web/mobile trusted-origin policies are environment-aware and tested.
- [x] Public version diagnostics do not reveal authentication configuration.
- [x] Production replay stub execution and fake `playtt.local` media publication are blocked.
- [x] Replay-ready callback authentication and HTTPS payload rules are isolated and tested.
- [x] GitHub Actions definitions exist for web, mobile, PostgreSQL-concurrency, migration-empty, web-build-e2e, mobile-test, and quality-gate checks.
- [x] The complete hosted workflow has passed on the target repository branch.

---



# Phase 0 — Stabilization and safety net



## Phase objective

Protect the working product, repair migration safety, close current security/concurrency defects, and establish a repeatable quality baseline before adding platform schema.

### P0-01 — Architecture and contract inventory

Feature checklist:

- [x] Inventory current web/API/mobile architecture and implemented versus mock features.
- [x] Freeze supported mobile API contracts and success/error fixtures.
- [x] Record authentication, booking, payment, Replay, and Coach response shapes.
- [x] Add the remaining web Server Action/browser contract fixtures.
- [x] Add a compatibility matrix for unknown status, capability, and event values.

Build guide:

1. Record every route, action, service, repository, provider, table, environment variable, mock, and external consumer.
2. Store deterministic fixtures with no real secrets or provider URLs.
3. Run contract validation in CI and require additive client-compatible changes.

Done means:

- [x] Every released web/mobile contract has a producer, consumer, success fixture, representative errors, and an automated validation result.



### P0-02 — Drizzle migration lineage repair

Feature checklist:

- [x] Pin repository migration hashes and critical custom SQL constraints.
- [x] Detect the missing `0001` snapshot and unjournaled `0002`–`0004` migrations.
- [x] Capture `__drizzle_migrations` and schema fingerprints from every environment.
- [x] Classify each environment as missing, exact, or partially drifted.
- [x] Recreate and validate canonical sequential metadata/snapshots.
- [x] Rehearse empty-database migration path (`migration-empty` CI job and `pnpm db:replay-lineage`).
- [x] Reconcile live ledgers only after complete DDL fingerprint equality.

**Live-migrate freeze lifted:** live environments were fingerprinted, classified, and reconciled. Future migrations still require the same empty/current-clone proof before production rollout.

Build guide:

1. Freeze unrelated schema changes.
2. Clone each environment to a disposable Neon branch/database.
3. Compare migrations, journal, snapshots, tables, enums, indexes, FKs, checks, GiST exclusion, and partial unique indexes.
4. Repair missing/partial DDL explicitly; never mark a migration applied based only on table existence.
5. Prove fresh and current-clone paths converge before enabling Phase 1.

Done means:

- [x] `db:validate:strict` passes; empty-database replay, idempotent seed, live/current-clone fingerprints, and ledger reconciliation are complete.



### P0-03 — Booking authorization and API safety

Feature checklist:

- [x] Booking Server Action derives user identity from the server session.
- [x] Client-controlled booking `userId` is removed.
- [x] Onboarding is enforced consistently before web booking creation.
- [x] Stable user/booking/payment/Replay/Coach error envelopes exist.
- [x] Production cron and trusted origins fail closed.
- [x] Automated forged-session/cross-user Server Action tests exist.
- [x] DB-free ownership-boundary tests cover booking detail, payment start/status, cancellation, and modification quote/apply/status.
- [x] Predicate-equivalent ownership scenarios are wired into the disposable PostgreSQL CI suite and have passed in hosted CI.

Build guide:

1. Resolve identity only from trusted session/bearer credentials.
2. Apply ownership and onboarding checks before domain writes.
3. Return stable codes without internal error text.
4. Test unauthenticated, forged-user, cross-user, invalid-input, and provider-failure cases.

Done means:

- [x] A user can book only for self, guessed IDs cannot cross ownership, and all negative authorization tests pass in CI.



### P0-04 — Concurrency and idempotency

Feature checklist:

- [x] Booking exclusion conflicts map to `SLOT_UNAVAILABLE`.
- [x] Confirmation, expiry, and cancellation use conditional expected-state transitions.
- [x] Modification/payment/credit application locks and applies once.
- [x] Replay-pack and Coach purchase confirmation is atomic/idempotent.
- [x] Disposable PostgreSQL concurrency scenarios are implemented.
- [x] Hosted disposable PostgreSQL concurrency scenarios have passed.
- [x] Email/history/ledger effects have durable logical idempotency identities where needed.

Build guide:

1. Keep PostgreSQL constraints as the final correctness authority.
2. Claim transitions with conditional update/row locks inside one transaction.
3. Write status history and financial ledgers in the same transaction.
4. Race duplicate and opposing operations against a disposable PostgreSQL instance.

Done means:

- [x] Same-slot, duplicate webhook, confirmation-vs-expiry/cancel, and duplicate modification tests produce exactly one legal effect under real PostgreSQL concurrency.



### P0-05 — Paystack, cron, and callback hardening

Feature checklist:

- [x] Paystack verifies constant-time SHA-512 HMAC over the exact raw body.
- [x] Invalid signatures never dispatch payment mutation.
- [x] Missing configuration and processing failures return retryable server errors.
- [x] Production expiry cron requires `CRON_SECRET`.
- [x] Replay-ready callback uses constant-time secret verification and bounded credential-free HTTPS URLs.
- [x] Development replay stub is disabled at two boundaries in production.
- [x] Paystack staging delivers a valid event to a deployed preview and confirms one booking.
- [x] Replay-ready callback passes with a staging edge/NVR client.

Build guide:

1. Verify raw request bytes before parsing.
2. Reject invalid authentication before any mutation.
3. Return non-2xx for retryable processing/configuration failures.
4. Preserve callback/polling reconciliation until the Phase 2 durable inbox exists.

Done means:

- [x] Provider test events prove valid, invalid, malformed, duplicate, delayed, and failure/retry behavior in a deployed environment.



### P0-06/P0-07 — Quality gates and baseline certification

Feature checklist:

- [x] Root and mobile static scripts exist.
- [x] Offline migration, contract, HTTP/auth, payment, replay, and database-guard tests exist.
- [x] GitHub Actions jobs exist for web quality, PostgreSQL concurrency, migration-empty replay, web build + Playwright, mobile static checks, mobile unit tests, and a required `quality-gate` aggregate.
- [x] Hosted GitHub Actions run passes.
- [x] Production build and Playwright golden path pass against an isolated seeded database (book hold, release hold, account).
- [x] Playwright covers seeded-session booking hold, unpaid cancellation, account access, hosted checkout return, modification, and full auth journeys.
- [x] Mobile Jest/React Native Testing Library unit suites exist for booking utils, API error mapping, and one screen component.
- [x] Android/iOS preview device smoke suites pass.
- [x] Golden-path and rollback rehearsal evidence is attached.

Build guide:

1. Run frozen dependency installs on clean runners.
2. Create isolated database fixtures and seed twice.
3. Build production artifacts, start the app, then run browser/mobile journeys.
4. Record reports, deployment version, feature flags, and rollback results.

Done means:

- [x] Every Phase 0 CI, migration, build, E2E, mobile, security, and rollback gate passes with linked evidence.



## Phase 0 exit

- [x] Migration lineage is canonical and safe.
- [x] All critical concurrency/security defects are closed.
- [x] Hosted CI, builds, E2E, mobile smoke, and disposable-database tests pass.
- [x] Existing web/mobile behavior remains compatible.
- [ ] Phase owner and reviewer approve entry into Phase 1.

---



# Phase 1 — Tenant and resource foundation



## Phase objective

Evolve the existing single-operator booking model into a tenant-aware venue/resource catalog without changing existing public IDs or released client behavior.

### P1-01 — Tenants, memberships, and brands

- [x] Add `tenants`, `tenant_memberships`, and optional `brands` additively.
- [x] Seed deterministic PlayTT tenant/brand records.
- [x] Backfill existing users with safe customer membership; assign operator roles explicitly.
- [x] Add membership-derived roles and permissions.

Build guide: create nullable/additive schema first, seed deterministic records, backfill through trusted relationships, then validate and enforce constraints.

Done means:

- [x] Every operator/customer action resolves a trusted membership and no tenant authority comes from request payloads.



### P1-02 — Venues

- [x] Evolve existing `locations` as the Venue aggregate; do not add a duplicate venue table.
- [x] Add tenant, optional brand, settings, archive state, timezone, and operating configuration.
- [x] Backfill Hurlingham without changing its ID or slug.

Build guide: expand `locations`, dual-read if necessary, backfill, validate composite tenant relationships, then switch domain naming to Venue.

Done means:

- [ ] Existing Hurlingham booking works unchanged and a second tenant/venue can be configured without code forks.



### P1-03 — Zones, resource types, capabilities, and rules

- [x] Add zones and assign resources to venue zones.
- [x] Add configurable resource types and map current `pod` to `table_tennis_table`.
- [x] Add human resource codes, ruleset/configuration, and capabilities.
- [x] Model scoring, replay, access, lighting, display, and camera capabilities.

Build guide: use data-driven types/capabilities; retain the legacy enum during migration and keep bookings attached to existing resource IDs.

Done means:

- [ ] A new resource type such as `golf_bay` can be configured through the operator workflow without changing booking/payment core code.



### P1-04 — Tenant backfill and database integrity

- [x] Add nullable `tenant_id` to all tenant-owned tables in dependency order.
- [x] Backfill through authoritative parent joins, never client input.
- [x] Add tenant-leading indexes and composite parent/child foreign keys.
- [x] Validate zero null/orphan/mismatched rows before `NOT NULL`.

Build guide: expand → resumable backfill → dual-write/read → `NOT VALID` constraints → validate → enforce → observe before contraction.

Done means:

- [ ] Zero tenant nulls, orphans, and cross-tenant parent mismatches exist in the production-like clone.



### P1-05 — TenantContext and RBAC

- [x] Derive `TenantContext` from membership, selected resource, or device credential.
- [x] Require tenant context in every tenant-owned repository method.
- [x] Add central action/scope authorization and audit records.
- [x] Add negative cross-tenant tests for every repository/API.

Build guide: default legacy clients to the PlayTT tenant server-side; never accept authoritative tenant IDs from body/query parameters.

Done means:

- [ ] Tenant A cannot read or mutate Tenant B data using guessed IDs across every implemented API/repository/operator path; media and realtime are gated in their later phases.



### P1-06/P1-07 — Operator catalog and legacy compatibility

- [x] Build authorized admin create/update screens/APIs for venues, zones, resources, memberships, vendors, and platform analytics. `/operator/*` redirects to `/admin`.
- [x] Preserve existing unversioned web/mobile contracts and IDs.
- [x] Add fields only; feature-flag new tenant/operator behavior.

Build guide: keep the modular monolith and current endpoint adapters; introduce new external versions only where contract value justifies them.

Done means:

- [ ] Old client fixtures pass while operators can configure two isolated tenants and venues.



### P1-08 — Access-point and door catalog

- [x] Add tenant/venue/zone access points for entrances and controlled areas.
- [x] Map each resource to every door required for a booking journey.
- [x] Support shared venue entrances and resource-specific doors.
- [x] Keep TTLock provider IDs out of booking logic.

Build guide: model logical access points first; provider locks/gateways are assigned later in Phase 5.

Done means:

- [ ] Hurlingham and a second venue can configure shared and table-specific doors without TTLock-specific code.



## Phase 1 exit

- [ ] All tenant backfills and composite constraints are validated.
- [ ] Cross-tenant negative tests pass everywhere.
- [ ] Existing booking/payment/mobile contracts pass unchanged.
- [ ] Operator catalog and access-point configuration work for two tenants.
- [ ] Rollback to legacy reads is rehearsed.

---



# Phase 2 — Payment hardening, play sessions, and durable events



## Phase objective

Make external events, payment confirmation, venue sessions, schedules, and side effects durable, idempotent, recoverable, and observable.

### P2-01 — Paystack webhook inbox

- [x] Add durable webhook inbox with unique provider identity/payload hash.
- [x] Store signature, receive/process state, attempts, timestamps, and errors.
- [x] Verify signature before domain processing.
- [x] Acknowledge only after durable inbox persistence.
- [x] Move processing fully behind inbox worker (P2-02).

Build guide: deploy inbox and worker before switching the existing webhook producer; preserve callback reconciliation.

Done means:

- [x] Duplicate/reordered valid events create one inbox identity and invalid signatures never enter processing.



### P2-02 — Transactional outbox and workers

- [x] Add versioned outbox envelope with tenant/venue/resource/session/correlation scope.
- [x] Implement database claiming, leases, retry/backoff, dead letter, and idempotent consumers.
- [x] Add worker health, backlog, failure, and replay controls.

Build guide: PostgreSQL is the durable queue of record; Redis may accelerate fan-out but cannot own correctness.

Done means:

- [x] Worker crashes/restarts recover committed work without duplicate logical effects.



### P2-03 — Operational play sessions

- [x] Add `play_sessions` without renaming Better Auth's `session` table.
- [x] Enforce one session per booking and scoped venue/resource ownership.
- [x] Add participants, state, scheduled/actual timestamps, correlation, and configuration snapshot.
- [x] Backfill sessions for existing eligible bookings idempotently.

Build guide: introduce a pure validated state machine and retain booking links for compatibility.

Done means:

- [x] Every confirmed booking has exactly one legal operational session and illegal transitions are rejected/audited.



### P2-04 — Atomic confirmation

- [x] Confirm payment and booking conditionally once.
- [x] Create/upsert play session, history, and outbox events in the same transaction.
- [x] Version payment/booking/session event names and payloads.

Build guide: no external email/device/media call occurs inside the transaction; only durable intent is committed.

Done means:

- [x] Concurrent duplicate confirmation creates one payment transition, booking confirmation, session, history record, and logical event.



### P2-05 — Durable lifecycle scheduler

- [x] Schedule prepare, start, ending, complete, reset, and reconciliation work durably.
- [x] Claim due work with row locks/leases.
- [x] Recreate missed jobs from authoritative session state.

Build guide: use scheduled server routes/workers, never in-process timers as the source of truth.

Done means:

- [x] Restarting the application cannot lose a session transition or permanently duplicate it.



### P2-06/P2-07 — Side effects and compatibility

- [x] Move confirmation email behind an idempotent outbox consumer.
- [x] Preserve existing booking/payment APIs, polling, receipts, and mobile return flow.
- [x] Add session fields only as compatible projections.

Build guide: deploy consumers first, then feature-flag producer cutover to prevent duplicate emails.

Done means:

- [x] Existing clients pass while all durable side effects recover after simulated crashes.



## Phase 2 exit

- [ ] Inbox/outbox/session migrations pass empty and current-clone tests in hosted PostgreSQL after the repaired 0000–0017 ordering.
- [ ] Duplicate, delayed, reordered, crash, retry, and dead-letter suites pass in hosted CI.
- [ ] Worker observability, tenant-scoped replay, and scheduled reconciliation are verified in the deployed environment.
- [ ] Existing checkout and callback UX is smoke-tested unchanged.

---



# Phase 3 — Devices, ESP32 scoring, and realtime



## Phase objective

Provision venue devices securely and make PostgreSQL-backed play sessions the authoritative source of scoring and live state.

### P3-01 — Device registry and enrollment

- [x] Add tenant/venue-owned devices with type, capability, firmware, and health.
- [x] Add one-time expiring enrollment/provisioning.
- [x] Store hashed, versioned, rotatable credentials with revocation.
- [x] Create dedicated `/api/device/v1/*` authentication separate from player auth.

Build guide: simulator first, HTTPS transport first, MQTT only after the contract is stable.

Done means:

- [ ] One-time enrollment, expiry, rotation, and revocation tests pass in hosted PostgreSQL; raw device secrets are never stored or logged.



### P3-02 — Assignments and configuration

- [x] Assign device roles/capabilities to resources with effective time windows.
- [x] Enforce one active assignment where required.
- [x] Deliver versioned configuration and acknowledge applied versions.

Build guide: device identity remains separate from resource identity so hardware can be replaced/reassigned without changing tables/bookings.

Done means:

- [ ] Wrong-tenant, wrong-resource, wrong-role, overlapping-window, and stale-assignment devices are rejected in hosted PostgreSQL.



### P3-03 — Heartbeats and fleet health

- [x] Record latest device health and sampled history.
- [x] Implement configurable offline detection and retention.
- [x] Surface exact venue/resource/device health to operators.

Build guide: keep latest health cheap; sample/partition history instead of storing every heartbeat forever.

Done means:

- [ ] Two-device isolation, monotonic timestamps, future-clock rejection, sampling, and retention pass in hosted PostgreSQL.



### P3-04 — Commands and acknowledgements

- [x] Add expiring commands, attempts, delivery state, acknowledgements, results, and correlation.
- [x] Reject expired/replayed commands and duplicate ACKs safely.
- [x] Add provider-neutral `DeviceCommandBus`/transport.
- [x] Add session/outbox-origin command intents; direct operator commands remain a diagnostic/manual path.

Build guide: commands originate from outbox/session intent and are never required for booking/payment transaction success.

Done means:

- [x] Retry, max-attempt timeout, expiry, concurrent duplicate ACK, disconnect, and restart tests converge to one command outcome in hosted PostgreSQL.



### P3-05/P3-06 — Authoritative table-tennis scoring

- [x] Add immutable score events unique by device/boot/sequence.
- [x] Add versioned score snapshots and correction/audit flow.
- [x] Validate active session and current assignment before accepting input.
- [x] Implement `tt_standard_v1` behind a `SportRulesAdapter`.

Build guide: transactionally insert event, apply rules/update snapshot, and write outbox event.

Done means:

- [x] Duplicate/out-of-order inputs never double-score and concurrent points produce one authoritative result in hosted PostgreSQL.



### P3-07 — Realtime displays

- [x] Add provider-neutral broadcaster and tenant/venue/resource/session channels.
- [x] Build kiosk and TV live-score displays.
- [x] Treat broadcasts as hints; clients reconcile authoritative snapshots.
- [x] Keep Redis optional for fan-out/presence only.

Build guide: publish after database commit/outbox processing, then refetch on gaps/reconnect.

Done means:

- [x] Two displays converge after missed events and Redis outage does not lose score truth.



### P3-08 — ESP32 firmware and simulator

- [x] Implement input debounce, boot/sequence IDs, offline buffer, retries, heartbeat, config, and command ACK.
- [x] Define signed OTA and firmware compatibility policy.
- [x] Run identical protocol tests against simulator and physical ESP32.

Build guide: freeze firmware v1 fixtures before venue installation and keep resource-specific configuration server-side.

Done means:

- [x] Simulator and staging ESP32 pass authentication, offline/retry, scoring, config, heartbeat, and command suites.



## Phase 3 exit

- [x] Device enrollment, assignment, credential, heartbeat, command, and scoring suites pass.
- [x] Cross-tenant/resource/session isolation passes.
- [x] Realtime displays reconcile correctly through outages.
- [x] One physical ESP32 completes the staging journey.

---



# Phase 4 — Private R2 media foundation



## Phase objective

Create private tenant-authorized replay media storage while preserving existing replay entitlement and library contracts.

### P4-01 — Media metadata

- [x] Add `media_assets` scoped to tenant, venue, resource, session, and owner.
- [x] Store immutable object key, kind, content type, size, checksum, status, retention, and timestamps.
- [x] Add optional media linkage to current replays.

Build guide: create metadata before upload; never treat a legacy public URL as an R2 object key.

Done means:

- [x] Every new object has one authorized metadata owner and a recoverable lifecycle state.



### P4-02 — MediaStore and R2 adapter

- [x] Define provider-neutral `MediaStore` operations.
- [ ] Configure separate private dev/staging/production buckets and scoped credentials.
- [x] Add fake adapter and staging provider contract tests.

Build guide: no R2 credential or provider-specific key logic enters browser/mobile/domain code.

Done means:

- [x] Adapter contract tests pass and public bucket access is disabled.



### P4-03 — Authorized upload/download grants

- [x] Generate exact object keys server-side.
- [x] Issue short-lived exact-operation PUT/GET grants after DB authorization.
- [x] Enforce content type, size, checksum, expiry, tenant/session/owner scope.

Build guide: authorize by metadata row, never by caller-supplied object key alone.

Done means:

- [x] Guessed IDs/keys and cross-user/tenant requests are denied even with a structurally valid key.



### P4-04 — Completion, deletion, and reconciliation

- [x] Process upload completion idempotently.
- [x] Verify size/checksum/type and transition state once.
- [x] Add delete retry, retention, and DB-to-R2 reconciliation.

Build guide: use inbox/idempotency identities for callbacks and keep failures retryable/visible.

Done means:

- [x] Duplicate callbacks are harmless and missing/unexpected/orphan/deletion-pending objects are detected.



### P4-05/P4-06 — Replay compatibility and infrastructure security

- [x] Dual-read explicit legacy replay URLs and new private assets.
- [x] Preserve replay credits/list/activity contracts.
- [x] Review bucket CORS, lifecycle, token scope, logging, and environment isolation.
- [ ] Remove legacy URL reads only after verified object migration.

Build guide: feature-flag new media reads/writes by tenant/resource and retain rollback to explicit legacy projection.

Done means:

- [x] Authenticated short-lived playback works, old clients pass, and no storage secret/public object leaks.



## Phase 4 exit

- [x] Metadata, grants, R2 adapter, callback, deletion, and reconciliation suites pass locally (`pnpm test:media`, migration `0020_media_assets`).
- [x] Cross-user/tenant media isolation passes in repository/service authorization tests.
- [x] Existing replay APIs remain compatible.
- [x] R2 outage cannot mark false-ready media or affect booking/payment.
- [ ] Hosted private-bucket staging smoke and production bucket credential rollout remain.

---



# Phase 5 — TTLock access and venue automation



## Phase objective

Give every paid booking an individual timed door code across the correct TTLock-controlled doors at every venue, with safe modification, revocation, reconciliation, and operator control.

### P5-01 — AccessProvider contract and simulator

- [ ] Define provision, modify, revoke, query, and reconcile operations.
- [ ] Define idempotency keys, credential states, retry classes, and redacted audit events.
- [ ] Build deterministic simulator for success, partial failure, timeout, duplicate, expiry, and provider outage.

Build guide: booking/session code calls only `AccessProvider`; TTLock-specific API details remain in the adapter.

Done means:

- [ ] Provider contract tests prove one logical credential lifecycle across retries and failures.



### P5-02 — TTLock connection, gateway, lock, and access-point inventory

- [ ] Store encrypted/server-only tenant TTLock connection credentials and token expiry.
- [ ] Sync gateways and locks per tenant connection.
- [ ] Map each TTLock to a logical Phase 1 access point.
- [ ] Record gateway connectivity, lock battery/clock/health, capabilities, and last sync.
- [ ] Support multiple venues, gateways, entrances, and resource-specific doors.

Build guide: commission development TTLock first, then staging gateway/locks; never hard-code lock IDs in booking code.

Done means:

- [ ] Operators can see correct tenant/venue/access-point assignments and no tenant can access another tenant's TTLock account or inventory.



### P5-03 — Booking-specific TTLock codes

- [ ] On paid confirmation, resolve all required doors from venue/resource access rules.
- [ ] Generate one secure booking-specific numeric passcode.
- [ ] Provision the same code with a bounded validity window on every required lock through its gateway.
- [ ] Store encrypted/revealable code or provider reference, never plaintext logs.
- [ ] Keep booking/payment confirmation successful if TTLock is down; access remains pending/retryable.

Build guide: session/outbox emits access intent; worker provisions asynchronously and records each door result.

Done means:

- [ ] One paid booking receives one individual code that opens only its assigned doors during the approved time window.



### P5-04 — Modify, revoke, expire, and reconcile

- [ ] Reschedule updates code validity safely.
- [ ] Venue/resource changes remove old-door access and provision new doors.
- [ ] Cancellation/expiry revokes every required lock code.
- [ ] Reconcile partial multi-door failures, gateway outages, token expiry, lock drift, and duplicate callbacks.
- [ ] Add manual fallback with restricted audited operator action.

Build guide: credential lifecycle is a state machine with per-door provider results and durable retries.

Done means:

- [ ] Cancelled/expired bookings cannot open doors, reschedules have no overlap gap, and partial failures recover visibly.



### P5-05 — Player access experience

- [ ] Replace preview PIN with authorized live code/status.
- [ ] Show venue, required door names, validity window, pending/failed/revoked state, and support guidance.
- [ ] Prevent code display for unauthorized, unpaid, cancelled, expired, or wrong-user bookings.
- [ ] Add secure notification delivery without exposing codes in logs/analytics.

Build guide: fetch access by booking ownership; never return codes in booking-list bulk payloads.

Done means:

- [ ] Web/mobile owner can reveal the valid code and all negative ownership/state cases are denied.



### P5-06 — TTLock operator tools

- [ ] Commission/test tenant connections, gateways, locks, and access points.
- [ ] View pending/failed credentials, battery/clock/connectivity, retry/revoke, and redacted unlock history.
- [ ] Implement restricted, reason-required, audited remote unlock.
- [ ] Add TTLock token/connection/gateway/lock alerts and runbooks.

Build guide: every support mutation requires tenant scope, permission, reason, correlation, and audit.

Done means:

- [ ] Operators can diagnose/recover access without database edits and all sensitive actions are audited.



### P5-07/P5-08 — Relays, venue preparation, and notifications

- [ ] Add `RelayProvider`/device commands for lighting, HVAC, scoreboard/display, and reset.
- [ ] Trigger prepare/end/reset intent from durable session events.
- [ ] Deliver booking, access-ready, access-failure, start, replay-ready, and support notifications idempotently.
- [ ] Keep all automation feature-flagged per venue/resource.

Build guide: hardware/provider failure never rolls back payment or booking; it creates visible retryable operational state.

Done means:

- [ ] Provider outage leaves bookings valid, manual operation possible, and every failed action visible/recoverable.



## Phase 5 exit

- [ ] Simulator and physical TTLock contract suites pass.
- [ ] Shared entrance and resource-specific door scenarios pass at two venues.
- [ ] Individual code provision/modify/revoke/expire/reconcile tests pass.
- [ ] Player code security and operator RBAC/audit tests pass.
- [ ] Booking/payment remain independent of TTLock outages.

---



# Phase 6 — Replay edge pipeline



## Phase objective

Capture session clips locally at venues, upload directly to private media storage, and expose authorized playback without routing continuous video through the cloud application.

### P6-01 — Replay request model

- [ ] Add `replay_requests` with tenant/venue/resource/session/activity/requester/window/state/correlation/media identity.
- [ ] Enforce active-session ownership, entitlement/credit, capability, and idempotency.
- [ ] Backfill compatibility requests for existing replay rows where appropriate.

Build guide: one logical request owns fixed replay/media/object identities across all retries.

Done means:

- [ ] Duplicate player/API requests debit once and create one request/asset.



### P6-02 — VenueEdge protocol and commands

- [ ] Define authenticated edge enrollment, heartbeat, configuration, command, ACK, retry, and status contract.
- [ ] Send expiring replay commands through durable device/outbox infrastructure.
- [ ] Keep camera/NVR credentials and network addresses out of web/mobile.

Build guide: use one venue edge per venue initially; configure resources/cameras through assignments.

Done means:

- [ ] Wrong tenant/resource/edge, expired command, duplicate command, and reconnect cases are safe.



### P6-03 — Local buffer extraction and direct upload

- [ ] Maintain local rolling camera buffers.
- [ ] Extract configured pre/post-roll clip for the correct session/resource/camera.
- [ ] Reuse fixed media identity/object key across retry.
- [ ] Upload directly with the Phase 4 exact PUT grant and report checksum/status.

Build guide: continuous RTSP/video stays on venue LAN; only requested clips upload to R2.

Done means:

- [ ] Retry/disconnect creates one correct private clip and never mixes tables/cameras.



### P6-04/P6-05 — Multi-resource configuration and playback

- [ ] Configure camera/edge assignments per resource without code forks.
- [ ] Mark media ready idempotently after verified upload.
- [ ] Preserve replay list/credit APIs and serve short-lived authorized playback.
- [ ] Trigger Coach analysis through durable ready event.

Build guide: compatibility adapter keeps current replay UI shape while storage internals change.

Done means:

- [ ] Ten resources select their configured cameras correctly and only authorized owners can play clips.



### P6-06 — Failure recovery and capacity

- [ ] Recover edge offline queue, process restart, missing buffer, extraction failure, upload failure, callback loss, and R2 outage.
- [ ] Define retention/cleanup for local buffers and failed/pending assets.
- [ ] Measure concurrent camera/extraction/upload capacity.

Build guide: all failure states are explicit, retryable or terminal with reason, and visible to operations.

Done means:

- [ ] Edge/R2 failure cannot affect booking/payment/session completion and measured venue capacity meets target.



## Phase 6 exit

- [ ] End-to-end request → edge → private upload → ready → playback passes.
- [ ] Idempotency, isolation, offline recovery, and multi-resource tests pass.
- [ ] Production replay stub is disabled.
- [ ] Capacity and retention evidence is approved.

---



# Phase 7 — Operations and scale certification



## Phase objective

Make the complete platform operable, observable, recoverable, secure, and certified for one table, ten tables, multiple venues, and multiple tenants.

### P7-01/P7-02 — Control plane, observability, and runbooks

- [ ] Build tenant/venue health overview for internet, edge, devices, resources, sessions, access, automation, media, and workers.
- [ ] Add correlated payment → booking → session → command/device/access/media timeline.
- [ ] Add alerts for webhook, worker, session, device, TTLock, gateway, command, replay, DB, Redis, and R2 failures.
- [ ] Link every alert to owner, severity, escalation, and recovery runbook.

Build guide: use correlation IDs and durable audit records across all modules; dashboards must identify the exact tenant/venue/resource/device.

Done means:

- [ ] Operators can detect, diagnose, and recover every rehearsed failure without direct database edits.



### P7-03 — Environment isolation and disaster recovery

- [ ] Verify dev/preview/staging/production isolation for DB, R2, Redis, Paystack, TTLock, device, realtime, and edge credentials.
- [ ] Rehearse database backup/restore and migration recovery.
- [ ] Rehearse R2 reconciliation/deletion recovery and secret/credential rotation.
- [ ] Define and measure recovery objectives.

Build guide: restore into isolated infrastructure and run migration plus product smoke suites before declaring recovery successful.

Done means:

- [ ] Backup restore, credential rotation, and provider isolation evidence meets approved recovery objectives.



### P7-04 — Venue network and fleet certification

- [ ] Implement management, camera, IoT, display, staff, and guest VLAN/firewall policy.
- [ ] Prevent guest/IoT access to camera and management networks outside approved paths.
- [ ] Verify DHCP/DNS/registry discovery and remove hard-coded infrastructure addresses.
- [ ] Measure switch, WAN, NVR/edge, camera, and device capacity.

Build guide: continuous camera traffic remains local and every field device is registered, assigned, monitored, and replaceable.

Done means:

- [ ] Network isolation tests and measured ten-resource load pass at the pilot venue.



### P7-05 — Single-table acceptance

- [ ] Player authenticates, books, pays, and receives one play session.
- [ ] Individual TTLock code opens all required doors only during validity.
- [ ] Resource prepares, ESP32 scores, and displays converge.
- [ ] Replay becomes one private playable asset.
- [ ] Session ends, access expires, resource resets, and timeline is complete.

Done means:

- [ ] The entire journey passes repeatedly on physical Table 01 with failure/rollback evidence.



### P7-06 — Ten-table and multi-tenant acceptance

- [ ] Configure ten resources without code forks.
- [ ] Run concurrent sessions without cross-talk in scoring, access, devices, realtime, or replay.
- [ ] Prove one device/provider failure does not affect another resource.
- [ ] Run two tenants with reusable human codes and complete data/provider isolation.
- [ ] Configure another resource type through data only.

Done means:

- [ ] Ten-table and two-tenant suites pass performance, isolation, correctness, and operational recovery targets.



### P7-07 — Progressive rollout

- [ ] Internal staff and simulator environment.
- [ ] Preview/staging with test providers and selected hardware.
- [ ] Operator-attended Table 01 pilot.
- [ ] Progressive first-venue resource rollout.
- [ ] Stable ten-table observation window.
- [ ] Second venue/tenant pilot.
- [ ] General availability approval.

Build guide: every stage has entry metrics, kill switches, manual fallback, rollback, and observation period.

Done means:

- [ ] General availability is approved only after all acceptance evidence, alerts, runbooks, support ownership, and rollback controls are live.



## Phase 7 and program exit

- [ ] All single-table, ten-table, multi-tenant, and failure-recovery suites pass.
- [ ] Security review has no unresolved critical/high findings.
- [ ] SLOs, alerts, on-call ownership, runbooks, and manual fallback are live.
- [ ] Booking/payment-only safe mode is tested.
- [ ] All phase evidence and owner/reviewer approvals are recorded.
- [ ] The complete PlayTT platform is approved for general availability.

---



# Per-feature delivery record template

Copy this block beneath a feature when work begins:

```text
Status: Not started | In progress | Blocked | In review | Done
Owner:
Ticket/PR:
Dependencies:
Feature flag:
Migration:
API/event/firmware contract:
Automated test evidence:
Manual/hardware test evidence:
Preview/staging deployment:
Monitoring/runbook:
Rollback tested:
Open risks:
Reviewer/sign-off:
```



# Next actions from the current position

- [x] Commit/review the current replay-ready callback hardening slice.
- [x] Obtain disposable/live database migration-ledger and schema fingerprints.
- [x] Repair and prove Drizzle lineage on empty and cloned-current databases.
- [x] Run the hosted PostgreSQL concurrency job and complete GitHub Actions quality run.
- [x] Add seeded production build and Playwright golden-path coverage.
- [x] Add mobile component/device smoke evidence.
- [ ] Sign Phase 0 exit before creating Phase 1 schema migrations.