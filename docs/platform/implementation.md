# PlayTT Platform Implementation Blueprint

## Document control

| Field | Value |
| --- | --- |
| Status | Canonical implementation blueprint |
| Target | PlayTT Platform Engineering Specification v2.0 |
| Delivery strategy | Foundation first, incremental modular monolith |
| Companion roadmap | [phases.md](./phases.md) |
| Execution playbook | [phase-build-and-test.md](./phase-build-and-test.md) |

This document translates the target engineering specification into a repository-specific implementation design. It is intentionally incremental: existing authentication, booking, payment, account, and mobile flows remain operational while the platform becomes multi-tenant, multi-venue, device-aware, and capable of running autonomous venues.

## 1. Outcomes and non-negotiable rules

The target platform must support one table, ten or more resources in a hall, multiple venues and cities, and independent tenant operators without code forks or separate databases per venue.

The implementation must satisfy these rules:

1. PostgreSQL is authoritative for tenants, bookings, payments, sessions, device assignments, scoring, commands, and media ownership.
2. Existing working booking and Paystack flows are preserved and protected by regression tests before structural changes.
3. Tenant scope is derived from authenticated membership or device credentials. Client-supplied `tenantId` is never trusted.
4. Existing `locations` and `resources` evolve into tenant-aware venue and resource records; duplicate replacement tables are not introduced. Venue entrances and internal controlled doors are modeled as access points mapped to the resources they serve.
5. The Better Auth `session` table remains authentication-only. Operational venue sessions use a new `play_sessions` table.
6. Critical transitions write domain events to a transactional outbox in the same transaction as the state change.
7. Redis may accelerate cache, presence, rate limiting, and realtime fan-out, but it is never the source of commercial or session truth.
8. R2 remains private. Clients and devices receive short-lived, exact-object grants after database authorization; they never receive R2 credentials.
9. Hardware and media integrations are asynchronous, retryable, observable, and feature-flagged. Provider failure must not reverse a valid payment or booking.
10. Each phase must be deployable, testable, observable, and reversible independently.

## 2. Current repository baseline

### Web, API, and database

- The repository root is a Next.js 16 / React 19 modular monolith using Better Auth, Drizzle ORM, Neon PostgreSQL, Paystack, and Resend.
- Web and mobile share the Next.js route handlers as the backend.
- Authentication, onboarding, booking, availability, pricing, pending holds, hosted Paystack checkout, callbacks/webhooks, booking modifications, history, replay credits, and Coach subscription foundations already exist.
- The current schema already contains authentication, locations, resources, bookings, modifications, credits, payments, status history, hardware configuration, access credentials, session event attempts, matches, replays, Coach, and notifications.
- Community, real access control, push delivery, hardware automation, realtime scoring, R2 media, and the production replay pipeline are not complete.

### Mobile

- `playtt-mobile/` is an independent Expo 54 / React Native application using npm.
- Authentication, onboarding, bookings, payment checkout, booking edits, account management, and booking history are live-backed.
- Coach, community, player statistics, entry codes, and parts of replay/activity remain preview or mock experiences.
- Mobile remains the player companion. Backend state is authoritative; the venue kiosk/tablet and TV are the primary live score projections.

### Immediate baseline defects

Phase 0 must resolve these before platform expansion:

- The web booking Server Action accepts a client-provided user ID instead of deriving the user from the authenticated session.
- Drizzle metadata registers only migrations `0000` and `0001`, while `0002` through `0004` exist as SQL files.
- Paystack handler failures are logged while the webhook still returns HTTP 200, suppressing retries.
- The booking-expiry endpoint is callable without authentication when `CRON_SECRET` is absent.
- Payment confirmation, expiry, cancellation, and modification credit flows have race/idempotency gaps.
- There is no automated test suite or CI quality gate.
- Web and mobile lint currently each contain a blocking error.

## 3. Target modular architecture

Keep the current two-app repository layout. Do not perform a speculative move into an `apps/` and `packages/` workspace. Strengthen boundaries in place:

```text
Web UI / Mobile / Kiosk / Device HTTP
                 |
        Route handlers and actions
                 |
       Application command/query services
                 |
  Identity | Catalog | Booking | Payments | Sessions
  Devices  | Scoring | Realtime | Media   | Automation
                 |
     Repositories and provider interfaces
                 |
 PostgreSQL | Redis | R2 | Paystack | ESP32 | Venue edge
```

### Bounded modules

| Module | Responsibility |
| --- | --- |
| Identity and tenancy | Memberships, tenant context, roles, permissions, user-to-tenant access |
| Catalog | Brands, venues, zones, resource types, resources, capabilities, rulesets |
| Booking | Availability, pricing, holds, reservations, cancellation, modification |
| Payments | Paystack adapter, webhook inbox, reconciliation, refunds, product payments |
| Sessions | Operational state machine, durable schedules, lifecycle reconciliation |
| Devices | Enrollment, credentials, assignments, health, configuration, commands, acknowledgements |
| Scoring | Immutable inputs, sport rules, snapshots, corrections, match projections |
| Realtime | Provider-neutral publish/fan-out and state reconciliation |
| Media and replay | Replay requests, media ownership, R2 grants, processing and playback |
| Automation | Access, locks, relays, lighting, vendor adapters |
| Notifications | Email, push, SMS consumers driven by durable events |
| Operations | Audit trail, incidents, diagnostics, fleet health, support actions |

Route handlers validate transport input, resolve actor/tenant context, call one application service, and map typed errors. They do not contain database orchestration or provider-specific business rules.

## 4. Domain and tenancy model

Canonical hierarchy:

```text
Platform
  -> Tenant / Operator
    -> Brand (optional)
      -> Venue (existing locations table)
        -> Zone / Hall
          -> Access point / Door
          -> Resource (existing resources table)
            -> Device assignments and capabilities
            -> Booking -> Play session -> Activity / Match -> Replay / Media
```

### Tenant context

Introduce a trusted server-side context:

```ts
type TenantContext = {
  tenantId: string
  actor: {
    type: "user" | "device" | "service"
    id: string
  }
  membershipId?: string
  role?: TenantRole
  venueIds?: string[]
  correlationId: string
}
```

Every tenant-owned repository method accepts `TenantContext`. Tenant-owned lookups include a tenant predicate even when the record ID is globally unique. Cross-tenant guessed IDs return a consistent not-found or forbidden response without revealing existence.

Permissions use actions such as `booking.read`, `device.command`, `media.download`, and `venue.manage`, evaluated against tenant and venue scope. Do not scatter raw role comparisons through route handlers.

### Schema evolution

Evolve the existing schema using expand, backfill, dual-read/write, validation, read switch, observation, and later contract:

| Current model | Target treatment |
| --- | --- |
| `locations` | Keep physical table; treat as venues and add tenant, brand, settings, and archive fields |
| `resources` | Keep IDs; add tenant, zone, resource type, human code, ruleset, and configuration |
| `bookings` and `payments` | Retain; add tenant scope and composite tenant/parent integrity |
| Better Auth `session` | Keep unchanged as authentication storage |
| `session_events` | Keep as automation/action attempts; link to `play_sessions`; do not use as the session aggregate |
| `hardware_configs` | Keep as vendor/venue integration configuration, not device identity |
| `matches` | Retain as activity projection; add tenant and play-session linkage |
| `replays` | Retain compatibility projection while requests and media ownership are split |
| `access_credentials` | Retain; add tenant/resource/session scope and secure secret handling |

New core tables are introduced by phase:

- Phase 1: `tenants`, `tenant_memberships`, `brands`, `zones`, `resource_types`, `resource_capabilities`, `access_points`, `access_point_resources`, `feature_flags`, `audit_logs`.
- Phase 2: `play_sessions`, `session_participants`, `payment_webhook_inbox`, `outbox_events`, optional `job_executions`.
- Phase 3: `devices`, `device_credentials`, `device_enrollments`, `device_assignments`, `device_heartbeats`, `device_commands`, `score_events`, `score_snapshots`.
- Phase 4: `media_assets`.
- Phase 6: `replay_requests`.

Money conversion from major-unit numeric/string values to integer minor units is a separate dual-write migration after tenant/session work is stable; it is not combined with Phase 1.

## 5. Compatibility contract

### Existing clients

The current web and released mobile clients must continue to work during Phases 0 through 4:

- Preserve `/api/bookings/*`, `/api/user/*`, payment completion URLs, Better Auth endpoints, and current `{ data: ... }` response envelopes.
- Add response fields additively and make new mobile fields optional until the minimum supported app version advances.
- Preserve opaque IDs, ISO timestamps, venue timezone, payment polling, app-resume reconciliation, booking modifications, and current hosted checkout behavior.
- Resolve the default PlayTT tenant on the server for legacy clients; never require an old client to send a tenant ID.
- Unknown statuses must render safely and must never expose access or privileged actions.

### New public interfaces

Representative platform APIs:

```text
GET  /api/v1/venues/:venueId/resources
GET  /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/replay-requests
POST /api/v1/media/:mediaId/upload-url
POST /api/v1/media/:mediaId/download-url

POST /api/device/v1/provision
POST /api/device/v1/heartbeat
POST /api/device/v1/events
GET  /api/device/v1/config
POST /api/device/v1/commands/:commandId/ack
```

Device APIs use dedicated device authentication, not Better Auth bearer fallback. Public and firmware APIs are versioned independently.

### Provider interfaces

Lock these ports before implementing vendor adapters:

```ts
interface PaymentProvider { /* initialize, verify, refund */ }
interface MediaStore { /* upload grant, download grant, delete */ }
interface RealtimeBroadcaster { /* publish projection event */ }
interface DeviceTransport { /* configuration and telemetry transport */ }
interface DeviceCommandBus { /* expiring command delivery */ }
interface AccessProvider { /* provision and revoke credential */ }
interface RelayProvider { /* execute configured circuit action */ }
interface SportRulesAdapter { /* validate config and apply score event */ }
interface VideoAdapter { /* select source and extract replay window */ }
```

The first device transport is HTTPS. MQTT is introduced only when persistent command delivery or fleet size justifies it.

## 6. Durable events and workflow rules

Critical transitions write an outbox event in the same transaction as domain state. The event envelope is versioned:

```ts
type DomainEventV1<T> = {
  eventId: string
  eventType: string
  occurredAt: string
  tenantId: string
  venueId: string | null
  resourceId: string | null
  sessionId: string | null
  correlationId: string
  causationId: string | null
  payload: T
}
```

Core events include `payment.confirmed.v1`, `booking.confirmed.v1`, `session.preparing.v1`, `session.started.v1`, `score.updated.v1`, `replay.requested.v1`, `media.uploaded.v1`, `device.online.v1`, and `session.completed.v1`.

Workers claim database rows using bounded leases or `FOR UPDATE SKIP LOCKED`, apply exponential backoff, record attempts, and move poison work to an observable dead-letter state. Consumers are idempotent by event ID or a domain-specific idempotency key.

No workflow relies on an in-memory `setTimeout`. A periodic reconciler recreates missing prepare/start/end/reset work after outages or deployments.

## 7. Device, scoring, and realtime design

Device identity is independent of resource identity. Enrollment exchanges a short-lived one-time code for a rotatable credential whose recoverable secret is shown only at issuance. Credentials are stored hashed where verification does not require recovery.

Score ingestion uses a unique `(device_id, boot_id, sequence)` identity:

1. Authenticate device and resolve its current assignment.
2. Verify tenant, venue, resource capability, and active play session.
3. Insert the immutable event or return the prior result for a duplicate.
4. Apply `tt_standard_v1` through `SportRulesAdapter`.
5. Update the versioned score snapshot and write `score.updated.v1` atomically.
6. Publish after commit; clients refetch the authoritative snapshot after reconnect or version gaps.

Redis presence keys and Pub/Sub are ephemeral. A Redis outage may delay presence or fan-out, but it must not prevent scoring events from being committed.

## 8. Media and replay design

Each media object has an authoritative `media_assets` row before upload. Object keys are generated server-side:

```text
tenant/{tenantId}/venue/{venueId}/resource/{resourceId}/session/{sessionId}/
  replay/{mediaId}/source.mp4
  replay/{mediaId}/preview.jpg
  replay/{mediaId}/derived-720p.mp4
```

The application authorizes the database record before issuing an exact-key, exact-operation, short-lived R2 grant. Bucket listing never determines user ownership. Upload completion is idempotent and validates expected content type, size/checksum policy, and asset status.

Continuous security recording remains local to the venue NVR/VMS. The replay edge buffers selected streams, extracts requested windows, and uploads only selected clips. One venue edge gateway serves multiple resources unless measured workload requires more.

## 9. TTLock access control

TTLock is the first production `AccessProvider`, not an unspecified future adapter. The customer flow is:

```text
Paid booking confirmed
  -> resolve venue/resource access points
  -> resolve each access point's assigned TTLock
  -> create one booking-specific timed keypad code on every required lock
  -> reveal the code to the booking owner with its validity window
  -> customer enters the code at the door keypad
  -> revoke/expire and reconcile after cancellation, reschedule, or session end
```

### Access-point and lock model

- `access_points` represents a physical security boundary such as `Hurlingham Main Entrance`, `Main Hall Door`, or a private resource door. It belongs to a tenant and venue and may belong to a zone.
- `access_point_resources` maps which doors a booking for a resource must pass through. One resource may require multiple doors; one entrance may serve many resources.
- TTLock locks and gateways are registered as devices. A lock is assigned to one access point; a gateway is assigned to its venue and may serve multiple nearby locks.
- Provider identity is scoped by tenant TTLock connection plus external lock ID. External IDs are never assumed globally unique across TTLock accounts or regions.
- Each production lock must record model, keypad/passcode version, timezone/clock state, battery, gateway reachability, firmware, last synchronization, and provider status.

### Provider connection and security

- Create one server-side TTLock Open Platform connection per tenant/provider account and environment. App credentials and access/refresh tokens remain encrypted server-side and are never returned to web, mobile, kiosk, firmware, or venue configuration.
- Implement `TTLockAccessProvider` behind `AccessProvider`; booking and session modules never call TTLock endpoints directly.
- The initial supported hardware profile requires a keypad lock compatible with TTLock custom timed passcodes and an online TTLock gateway. The gateway is required for remote creation, change, and deletion of custom codes.
- Mobile does not need the TTLock SDK for the keypad-code flow. It receives an authorized PlayTT access payload and the customer enters the code physically at the door.
- Remote unlock is a separate operator-only emergency action requiring permission, recent re-authentication, a reason, rate limiting, and an audit record. It is not exposed as a normal customer action.

### Code policy

- Generate a cryptographically secure eight-digit numeric code per confirmed booking. Eight digits remain within TTLock's documented custom-passcode range.
- Reuse that booking code across all required access points when every assigned lock supports remote custom codes. Check collisions independently on every target lock before provisioning.
- If a required lock cannot accept the shared code, do not silently expose partial access. Keep the access grant in `provisioning`/`failed`, alert operations, and use the documented manual fallback. A future per-door-code fallback must be an explicit product change.
- Validity is `booking start - venue early-entry window` through `booking end + venue grace period`; the current default grace period is five minutes. Convert venue-local policy to TTLock millisecond timestamps using the venue timezone and verify lock clock/timezone health.
- Provision immediately after paid confirmation so the player receives the code with a clear `Valid from` time. A code is not returned while booking payment or TTLock provisioning is pending.
- Store the revealable code using application-level envelope encryption and expose only a masked value in logs, admin lists, analytics, and routine API responses. Full reveal requires the authenticated booking owner or an authorized operator.

### Credential state and lifecycle

`access_credentials` remains the customer-facing credential aggregate and gains tenant, venue, resource, play-session, access-point, provider-connection, external passcode ID, encrypted secret, validity, attempts, error, provisioned, revoked, and reconciled fields. One booking-level access grant groups the per-access-point TTLock credentials.

Lifecycle behavior:

1. `booking.confirmed.v1` creates an idempotent access-provision intent.
2. The worker resolves the booking's required access points and assigned locks, then creates the same timed code on each lock through its gateway.
3. The booking grant becomes `active` and revealable only when every required door succeeds.
4. Cancellation revokes all codes. A time/resource/venue edit modifies compatible credentials or provisions replacements before revoking obsolete credentials.
5. Natural TTLock expiry is still followed by deletion/reconciliation so provider state and PlayTT state agree.
6. Unlock records are synchronized for audit/support using external passcode identity; codes are redacted from operational logs.

Provision, modify, revoke, reconcile, and unlock-record ingestion are idempotent. Token expiry, rate limits, gateway offline, lock offline, low battery, clock skew, unsupported passcode version, partial multi-door success, and TTLock API outages are explicit retryable or terminal error classes.

### Multi-venue operation

Adding a venue requires configuration, not code:

1. Create the venue, zones, resources, and access points.
2. Configure its TTLock provider connection or approved tenant connection.
3. Register gateways and locks, then assign each lock to an access point.
4. Map resources to their required access points.
5. Run gateway/lock health, code create/reveal/use/revoke, clock, battery, and audit-record commissioning tests.
6. Enable `liveAccess` for the venue only after commissioning passes.

Official TTLock references used for the first adapter:

- [TTLock Open Platform - Add a passcode](https://euopen.ttlock.com/doc/api/v3/keyboardPwd/add)
- [TTLock Help Center - Gateway capabilities](https://ttlockdoc.ttlock.com/en/docs/%E5%BF%AB%E9%80%9F%E5%AD%A6%E4%B9%A0/App/%E9%85%8D%E5%A5%97%E8%AE%BE%E5%A4%87)
- [TTLock Open Platform - Unlock records](https://cnopen.ttlock.com/doc/api/v3/lockRecord/list)

## 10. Automation and failure policy

Session events drive access, relay, lighting, display, and reset intents through outbox consumers. Commands include an ID, expiry, nonce/idempotency identity, target assignment, desired action, attempt state, and acknowledgement state.

Provider outages follow this policy:

- Booking/payment truth remains committed.
- The automation action becomes pending or failed with a visible reason.
- Reconciliation retries safely.
- Operators receive an alert and can use audited manual fallback actions.
- Feature flags can disable a provider per tenant, venue, resource, or capability without redeploying the client.

## 11. Environments, security, and rollout

Use isolated development, preview, staging, and production database, R2, Redis, payment, and device credentials. Runtime uses the pooled Neon URL; migration tooling uses the direct URL where session semantics require it.

Required rollout pattern for schema-dependent work:

1. Expand schema with nullable/additive structures.
2. Deploy code capable of old and new reads.
3. Run resumable server-controlled backfills.
4. Verify row counts, nulls, orphan/mismatch queries, constraints, and schema fingerprint.
5. Add and validate constraints; use `NOT VALID`/later validation or concurrent indexes where needed.
6. Switch reads behind a feature flag.
7. Observe at least one release window.
8. Remove legacy structures only in a later approved contract release.

Never deploy a producer before its consumer can safely ignore or process the event version. JavaScript-only mobile changes may use EAS Update rollback; native changes require a new store binary and minimum-version policy.

## 12. Observability and operations

Every cross-system workflow carries a correlation ID from HTTP/webhook through payment, booking, session, device command, media, and notification processing.

Minimum operational views:

- Request status and latency by tenant/route/actor.
- Payment webhook signature, inbox, processing attempts, and final outcome.
- Session transition timeline and stuck-state alerts.
- Device last seen, firmware, RSSI, uptime, active session, assignment, and last error.
- Command issue/delivery/acknowledgement/failure timeline.
- TTLock connection, gateway, lock battery/clock/status, credential provisioning/revocation, and redacted unlock-record timeline.
- Replay request, edge receipt, upload, processing, ready/failure timeline.
- Worker backlog, retries, dead letters, database latency, Redis latency, and realtime connections.
- Tenant/venue/resource-scoped audit records for privileged actions.

## 13. Global definition of done

The platform is complete only when:

- A user can book and pay through existing web or mobile flows without regressions.
- A valid Paystack webhook creates exactly one confirmed booking and one operational session.
- An assigned ESP32 can score an active session exactly once per physical input while kiosk and TV converge on server state.
- Access and automation execute or fail safely with visible, retryable operational state.
- Every paid booking receives one individual timed code provisioned across all required TTLock-controlled doors; cancelled, expired, wrong-user, wrong-venue, and guessed credentials cannot grant access.
- Replay requests produce one authorized private media asset and short-lived playback access.
- Ten resources operate concurrently without state, score, device, or media cross-talk.
- Guessed IDs cannot cross tenant boundaries.
- A new venue/resource is configuration and assignment work, not a code fork.
- Production support can trace and recover payment, session, device, command, and replay failures remotely.

Execution order and gates are defined in [phases.md](./phases.md). Step-level build, testing, deployment, and rollback instructions are defined in [phase-build-and-test.md](./phase-build-and-test.md).
