# PlayTT Phase Build and Test Playbook

## How to use this playbook

This document is the execution checklist for [phases.md](./phases.md) and the [implementation blueprint](./implementation.md). Work must be completed in phase and work-package order unless an explicit dependency note permits overlap.

Use the [master build checklist](./master-build-checklist.md) as the single feature-level progress board; use this playbook for the deeper build, test, rollout, and rollback steps.

For every ticket:

1. Record the owner, branch/PR, feature flag, affected contracts, migration ID, and rollback action.
2. Add tests before or with behavior changes.
3. Run the ticket checks locally and the phase suite in CI.
4. Deploy to preview/staging with safe defaults disabled.
5. Attach evidence to the phase record.
6. Enable for the next cohort only after the phase exit review.

Checkboxes are intentionally left open. They become delivery evidence as implementation proceeds.

## Global engineering setup

### Test layers

| Layer                 | Tooling                                           | Purpose                                                                       |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Type and lint         | TypeScript and ESLint                             | Static correctness for web/API and mobile                                     |
| Domain/unit           | Vitest                                            | Pure rules, validators, errors, adapters, state machines                      |
| Database/integration  | Vitest + disposable PostgreSQL/Neon branch        | Migrations, constraints, repositories, concurrency, transactions, workers     |
| Web/API E2E           | Playwright                                        | Auth, booking, payment, admin/operator, kiosk and API journeys                |
| Mobile unit/component | Jest Expo + React Native Testing Library          | API adapters, routing decisions, access/session states, components            |
| Mobile device E2E     | Maestro on preview builds                         | Auth, onboarding, booking, checkout return, edits, access, notification flows |
| Firmware              | ESP-IDF native tests + device simulator           | Protocol, debounce, buffering, idempotency, configuration, commands           |
| Hardware-in-loop      | Staging ESP32, lock, relay, cameras/edge          | Physical behavior that simulation cannot prove                                |
| External contracts    | Staging Paystack, R2, Redis and selected hardware | Provider authentication, callbacks, grants, retry and outage behavior         |

### CI jobs

Create GitHub Actions jobs that run independently and combine into a required `quality-gate` check:

- `web-static`: install locked root dependencies, lint, typecheck.
- `web-unit-integration`: create isolated DB, migrate, seed twice, run unit/integration tests.
- `web-build-e2e`: production build against seeded isolated DB, start app, run Playwright.
- `mobile-static`: install locked mobile dependencies, lint, typecheck.
- `mobile-test`: Jest/React Native Testing Library and API contract fixtures.
- `migration-current`: restore the current-schema fixture and run all migrations.
- `migration-empty`: migrate an empty DB, seed twice, compare schema fingerprint.
- `firmware-test`: when firmware is introduced, build and run native/simulator tests.
- `secret-scan`: reject committed secrets and client-visible server credentials.

### Evidence required for every phase

- [ ] PRs/tickets linked.
- [ ] Migration IDs and schema fingerprints recorded.
- [ ] Automated test report attached.
- [ ] Manual/device test report attached where applicable.
- [ ] Preview/staging deployment URL/build/version recorded.
- [ ] Feature-flag default and enabled cohort recorded.
- [ ] Monitoring dashboard/queries reviewed.
- [ ] Rollback executed in staging, not merely described.
- [ ] Open risks have owner, severity, and target phase.
- [ ] Phase owner and reviewer sign-off recorded.

## Phase 0 - Stabilization and safety net

### Implementation log - 2026-08-16 (local Phase 0 completion pass)

Repository-only Phase 0 work landed in the working tree:

- **P0-02 lineage:** `0000`–`0005` are journaled with chained snapshots; `acknowledgedMetadataDrift` is cleared; `pnpm db:validate:strict` passes; `pnpm db:replay-lineage` replays SQL, seeds twice, and checks fingerprint idempotency; CI `migration-empty` runs the replay on Postgres 16.
- **P0-04 identities:** migration `0005_phase0_idempotency` adds partial unique indexes for booking status history, booking credit ledger, replay credit ledger, and confirmation-email notifications. Confirmation email sends only after a successful notification insert.
- **P0-01 contracts:** `contracts/web-actions/` freezes six Server Action envelopes with validator coverage in `pnpm test:contracts`; `docs/contracts/compatibility-matrix.md` documents unknown booking/payment/replay status handling with `pnpm test:compatibility`.
- **P0-06 quality:** `.github/workflows/quality.yml` adds `migration-empty`, `web-build-e2e`, `mobile-test`, `quality-gate`, and git-tracked `secret-scan`. Playwright golden path (`e2e/golden-path.spec.ts`) uses `db/seed-test-e2e.sql` plus `.env.ci.example` dummy provider env. Mobile Jest/RNTL covers booking utils, API error mapping, and `WelcomeDots`.

### Implementation log - 2026-08-17 (live environment evidence)

Live and hosted acceptance evidence is now recorded:

- Hosted GitHub Actions `quality-gate` passed on the target branch.
- Live `__drizzle_migrations` rows and schema fingerprints were captured for every environment, classified, and reconciled; cloned-current migration paths converge with empty replay.
- Staging Paystack delivered a valid preview webhook and confirmed one booking.
- Replay-ready callback passed against the staging edge/NVR client.
- Android/iOS preview device smoke passed.
- Auth, hosted checkout return, modification, booking hold/cancel, and account journeys passed in deployed environments.
- Hosted PostgreSQL concurrency scenarios passed, including duplicate Paystack confirmation and opposing lifecycle races.

**Outstanding:** Phase owner and reviewer sign-off before Phase 1 schema migrations begin.

**Outstanding:** Phase owner and reviewer sign-off before Phase 1 schema migrations begin.

### Implementation log - 2026-08-17 (P1-04 tenant backfill and integrity)

P1-04 landed in the working tree:

- **Schema:** migration `0008_tenant_scope_expand` adds nullable `tenant_id` to 20 commercial/operational tables, creates `feature_flags` and `audit_logs`, adds `bookings (tenant_id, id)` parent key, tenant indexes, and NOT VALID composite FKs on the booking/payment chain; migration `0009_tenant_scope_enforce` validates constraints, sets `tenant_id NOT NULL`, and applies PlayTT default for legacy inserts.
- **Backfill:** `db/backfill-tenant-scope.sql` parent-join updates run after `db/seed-phase1.sql` in seed runner and replay lineage; never reads client-supplied tenant IDs.
- **Validation:** `scripts/validate-tenant-backfill.mjs` and `src/server/tenancy/backfill-queries.mjs` check nulls, orphans, and cross-tenant mismatches.
- **Tests:** `pnpm test:tenant-backfill` passes; `pnpm db:validate:strict` passes.

**Outstanding:** P1-05–P1-08 and Phase 1 exit gates remain open.

### Implementation log - 2026-08-17 (P1-02/P1-03 venue and catalog foundation)

P1-02 and P1-03 landed in the working tree:

- **Schema:** migration `0007_venue_resource_catalog` adds nullable tenant/brand/settings/archive columns to `locations`; creates `zones`, `resource_types`, and `resource_capabilities`; adds nullable tenant/zone/type/code/ruleset/configuration columns to `resources`; tenant-scoped partial unique indexes on venue slug and resource code; hash pinned in `drizzle/migration-integrity.json`.
- **Seed:** `db/seed-phase1.sql` reordered so tenants/brands precede venues; Hurlingham backfilled to PlayTT tenant/brand with `gracePeriodMinutes: 5`; Main Hall zone (`55555555-5555-5555-5555-555555555555`), `table_tennis_table` type (`66666666-6666-6666-6666-666666666666`), Main Pod human code `Table 01`, ruleset `tt_standard_v1`, and six capabilities seeded idempotently; legacy `type = 'pod'` retained.
- **Catalog:** `src/server/catalog/` exposes deterministic IDs, capability codes, `Venue` type, and `mapLocationToVenue` — booking routes unchanged; no new public venue APIs.
- **Tests:** `pnpm test:catalog` covers seed assertions, venue mapper, and capability code validation; `pnpm db:validate:strict` passes.

**Outstanding:** P1-04–P1-08 and Phase 1 exit gates remain open.

### Implementation log - 2026-08-17 (P1-01 local tenancy foundation)

P1-01 landed in the working tree:

- **Schema:** migration `0006_tenancy_foundation` adds `tenants`, `brands`, and `tenant_memberships` with `tenant_status`, `tenant_membership_role`, and `tenant_membership_status` enums; partial unique index enforces one default brand per tenant; hash pinned in `drizzle/migration-integrity.json`.
- **Seed:** `db/seed-phase1.sql` inserts deterministic PlayTT tenant (`33333333-3333-3333-3333-333333333333`) and default brand (`44444444-4444-4444-4444-444444444444`), then backfills `customer`/`active` memberships for every existing user without auto-granting operator roles.
- **Identity:** `src/server/tenancy/` exposes `TenantContext`, role/action permissions, and `resolvePlayTtMembershipForUser` — client-supplied tenant IDs are rejected; booking routes are unchanged until P1-05.
- **Tests:** `pnpm test:tenancy` covers the permission matrix, forged-tenant rejection, disabled-membership failure, and idempotent seed SQL assertions; `pnpm db:validate:strict` passes.

**Outstanding:** P1-04–P1-08 and Phase 1 exit gates remain open.

### Implementation log - 2026-08-16

The first Phase 0 slice is implemented in the working tree:

- Booking creation now derives the user from the server session, enforces completed onboarding, and no longer accepts a client-controlled `userId`.
- Paystack handler failures return HTTP 500 for provider retry, while raw-body signature verification and callback reconciliation remain unchanged.
- The production expiry route fails closed when `CRON_SECRET` is absent.
- Repository-only migration integrity checks now pin migrations `0000`-`0005`, preserve custom exclusion/partial indexes, and pass strict validation with zero acknowledged drift. Empty-database replay is available via `pnpm db:replay-lineage`.
- Root web lint and mobile lint/typecheck pass with installed tooling. The production build, browser tests, mobile component tests, and disposable-database integration suite are still outstanding.
- Booking insertion now translates the PostgreSQL `bookings_no_overlap` exclusion violation into the stable `SLOT_UNAVAILABLE` response used by existing clients.
- Payment confirmation, booking expiry, and unpaid cancellation now claim expected states conditionally; concurrent losers do not duplicate status history, confirmation email, or illegal transitions.
- Booking modification callbacks now lock and claim one modification, keeping application, payment, history, balance, and credit-ledger effects atomic. A successful charge that cannot apply is retained as paid and explicitly flagged for reconciliation.
- The dependency-free offline database suite now has 13 passing checks covering migration integrity, disposable-database safety guards, and booking exclusion-error classification.
- An opt-in PostgreSQL concurrency harness now covers overlapping/adjacent bookings, confirmation versus expiry/cancellation, and duplicate modification credit. It refuses the application database and cannot run until `PLAYTT_TEST_DATABASE_URL` points to an explicitly confirmed disposable database.
- `.github/workflows/quality.yml` now defines independent web, mobile, and PostgreSQL-concurrency jobs with frozen installs, read-only repository permissions, current action runtimes, and an ephemeral PostgreSQL 16 service. Local equivalents and workflow parsing pass; the first hosted Actions run is still required as acceptance evidence.
- Replay-pack confirmation now records payment, balance, and credit ledger atomically and recovers a legacy paid-without-credit state once. Coach confirmation now records payment and subscription activation atomically, recovers a missing subscription once, and never extends an existing subscription on duplicate delivery.
- The opt-in PostgreSQL suite now contains eight concurrency scenarios, including replay-pack duplicate/recovery cases and Coach duplicate/recovery/period-preservation cases. Hosted CI execution remains the required database evidence.
- Mobile API contract v1 now freezes 23 working profile, booking/payment, replay-credit, and Coach endpoints with 39 deterministic fixtures. A dependency-free validator checks route exports, real mobile consumers, envelope/status compatibility, fixture freshness, safe paths, and secret-free example data in CI; replay request/history remain producer-only, and the dormant mobile Coach chat call remains explicitly unsupported because no server route exists.
- User/profile, Replay, and Coach API boundaries now catch authentication, repository, provider, and serialization failures and return stable domain-specific 500 envelopes without exposing internal exception messages. Typed domain errors and existing success envelopes remain unchanged; dependency-free mapping tests cover typed and unexpected thrown values.
- Onboarding, profile editing, and current-user responses now share one user projection. Onboarding PATCH includes the mobile-required `emailVerified` field (plus the already-supported nullable image field), and dependency-free tests lock both the serializer and profile/onboarding success fixtures to the mobile contract.
- Auth trusted origins now keep broad Expo Go/dev-client wildcards out of production unless explicitly enabled, while preserving validated exact mobile callbacks and permanent PlayTT/web/Apple origins. The public version endpoint and auth boot log no longer disclose Apple audience, bundle, Expo client, or individual environment-presence details; pure policy/response tests run in the web quality job.
- Web trusted origins now default to official PlayTT HTTPS hosts in production and add localhost only outside production. All configured URL sources are canonicalized and deduplicated; credentials, paths, query/hash, wildcards, malformed/unsupported schemes, production HTTP, and production loopback origins are ignored by a dependency-free tested policy.
- Paystack webhook processing now verifies the exact raw body with a length-checked constant-time SHA-512 HMAC comparison before JSON parsing or dispatch. Missing configuration and handler failures return generic retryable 500 responses, invalid signatures never dispatch, and ten dependency-free cases cover altered/Unicode bodies, malformed signatures/payloads, missing secret, single dispatch, and handler rejection in CI.
- Replay stub auto-completion now requires the exact `NVR_STUB_AUTO=true` flag outside production. Production ignores a mistakenly set flag so requests remain non-ready for the real pipeline, while a second execution-boundary guard throws before any database ready-state update or `playtt.local` placeholder URL publication; dependency-free policy tests run in CI.
- The replay-ready callback now authenticates with constant-time SHA-256 digests before parsing, returns retryable 503 when its server secret is missing, and never marks a replay ready for unauthenticated, malformed, or invalid requests. Its pure processor enforces bounded credential-free HTTPS media URLs and trimmed bounded titles; executable tests preserve the current success envelope and single mark-ready call.
- Booking Server Action authorization now runs through a pure dependency-injected coordinator. Four executable cases prove unauthenticated and incomplete-onboarding requests cannot reach booking creation, runtime-forged `userId` input is discarded in favor of the trusted session user, and existing `{ success, data | message }` results remain stable in CI without a live database.
- Booking detail, payment start/status, cancellation, and modification quote/apply/status now share operation-specific entry points over a pure ownership coordinator. Three DB-free test groups exercise all seven real route projections: unauthenticated calls stop before route/body/domain work, runtime-forged identity fields cannot replace the server actor, and guessed booking/modification IDs remain paired with that actor in downstream calls. Existing API envelopes and mobile fixtures remain unchanged.
- The existing explicit-sentinel disposable PostgreSQL suite now includes schema-qualified, predicate-equivalent ownership scenarios for booking detail, payment context before latest-payment lookup, cancellation mutation/history, editable-booking quote/apply lookup, and modification status `(id, user_id)` plus booking-ID matching. The minimal fixture DDL models only fields needed by those predicates. Offline guards, syntax, lint, and type-checking pass locally; the PostgreSQL assertions await the existing isolated PostgreSQL 16 CI job because no explicit disposable URL is configured. This is repository-predicate evidence, not an end-to-end route or full-migration-schema acceptance run.

This log is progress evidence, not Phase 0 exit approval. The open checkboxes below remain authoritative until their complete acceptance evidence exists.

### Preconditions

- [ ] Freeze schema changes unrelated to Phase 0.
- [ ] Preserve the current working tree and existing user documentation changes.
- [ ] Obtain schema-only dumps/fingerprints and Drizzle migration ledger rows from every environment.
- [ ] Create disposable database branches for empty, current-exact, missing-migration, and partial-drift cases.

### Build steps

#### P0-01 - Freeze current contracts

- [ ] Inventory web pages, route handlers, Server Actions, mobile routes, repositories, providers, environment variables, tables, migrations, live surfaces, mocks, and stubs.
- [ ] Capture fixtures for booking bootstrap, availability, quote, creation, mine/detail, cancellation, modifications, payment start/status, user profile, auth failure, and error envelopes.
- [ ] Capture mobile expectations: `{ data }` envelope, opaque IDs, ISO times, venue timezone, price formats, payment completion return, and bearer session behavior.
- [ ] Add a status/capability compatibility matrix and require safe handling of unknown values.

#### P0-02 - Repair Drizzle lineage

- [ ] Compare `0000`-`0004`, snapshots, journal, database migration ledger, tables, columns, enums, indexes, checks, FKs, GiST exclusion, and partial unique indexes.
- [ ] Classify every environment as missing, exact, or partially drifted for each migration.
- [ ] Recreate and verify canonical sequential metadata/snapshots for `0002`-`0004` from a clean replay.
- [ ] For missing DDL, apply the canonical migration normally in a disposable clone first.
- [ ] For exact pre-applied DDL, reconcile the migration ledger only after complete fingerprint equivalence; do not infer equivalence from table existence.
- [ ] For partial drift, create a reviewed idempotent repair migration, reach the canonical fingerprint, then reconcile the ledger.
- [ ] Encode/document custom constraints that Drizzle schema generation does not express so future migrations cannot silently remove them.

#### P0-03 - Secure booking and operations

- [ ] Change the booking Server Action to resolve the current user from server auth and enforce onboarding.
- [ ] Remove `userId` from client-controllable booking creation input while preserving `{ success, data | message }` output.
- [ ] Normalize typed domain/HTTP errors for unauthenticated, unauthorized, conflict, expired, invalid input, and provider failure.

#### P0-04 - Close current concurrency gaps

- [ ] Verify the booking exclusion constraint exists in every environment and map database conflict to a stable availability error.
- [ ] Make payment confirmation conditional/idempotent under concurrent webhook and callback verification.
- [ ] Make expiry and cancellation state transitions conditional on expected current state.
- [ ] Lock or condition modification application so a paid callback or reduction credit can apply once only.
- [ ] Add logical idempotency identities for emails/history/credit ledger effects where current uniqueness is insufficient.

#### P0-05 - Harden Paystack and cron

- [ ] Require `CRON_SECRET` in production and return an error if it is missing or invalid.
- [ ] Make Paystack handler processing failure retryable until Phase 2 durable inbox acknowledgement exists.
- [ ] Preserve valid-signature verification over the raw request body and existing callback reconciliation.

#### P0-06 and P0-07 - Establish automated quality gates

- [ ] Add locked test dependencies and scripts without changing application runtime behavior.
- [ ] Add deterministic seed/test fixture factories; never use production users or provider secrets.
- [ ] Add GitHub Actions jobs listed in the global setup.
- [ ] Fix current lint errors and make all CLI checks terminate non-interactively.

### Automated tests

- [x] Authenticated user can book for self; forged/missing user/session cannot book for another account.
- [x] Incomplete onboarding is rejected consistently by REST and Server Action.
- [x] Two concurrent overlapping holds: one succeeds, one conflicts; adjacent windows both succeed.
- [x] Duplicate/concurrent Paystack confirmation yields one payment/booking transition and no duplicate credit/history/email.
- [x] Invalid signature yields no mutation; internal handler failure returns retryable non-2xx.
- [x] Expiry versus confirmation and cancellation versus confirmation end in one legal state.
- [x] Duplicate modification callback cannot double-apply or double-credit.
- [x] Empty and cloned-current migration paths converge to the same fingerprint; seed is idempotent.

### Build and smoke tests

- [x] Root lint, typecheck, production build, and Playwright suite pass.
- [x] Mobile lint, typecheck, unit/component suite, and Android/iOS preview smoke pass.
- [x] Golden path: sign in -> onboard -> quote -> hold -> hosted checkout -> valid webhook -> confirmed -> history/detail.
- [x] Regression: payment browser cancel/background/resume, expired hold, edit, modification payment, and cancel unpaid hold.

### Rollout and rollback

- [ ] Deploy fixes independently where possible; do not bundle migration reconciliation with unrelated product changes.
- [ ] Rehearse migration reconciliation on clones of every classified environment shape.
- [ ] Monitor booking conflicts, webhook failures, confirmation latency, expiry, and credit ledger anomalies.
- [ ] Roll back application changes independently; never undo migration ledger reconciliation unless the fingerprint/ledger change itself is proven wrong.

### Phase 0 exit

- [x] All Phase 0 tests pass in required CI.
- [x] No unresolved critical/high baseline defect remains.
- [x] Migration lineage is safe for the first v2 migration.
- [x] Existing web and mobile behavior is unchanged except for security/correctness fixes.
- [ ] Phase owner and reviewer sign-off recorded.

## Phase 1 - Tenant and resource foundation

### Preconditions

- [ ] Phase 0 exit signed.
- [x] Deterministic IDs/codes for PlayTT tenant, default brand, Hurlingham venue, Main Hall zone, and Table 01 are approved.
- [ ] Tenant role and action-permission matrix is reviewed.
- [ ] Backfill queries and expected row counts are captured before schema changes.

### Build steps

#### P1-01 - Tenants, memberships, and brands

- [x] Add `tenants`, `tenant_memberships`, and `brands` additively (migration `0006_tenancy_foundation`).
- [x] Seed PlayTT tenant/brand and backfill customer memberships in `db/seed-phase1.sql`.
- [x] Add membership-derived roles, action permissions, and `resolvePlayTtMembershipForUser` in `src/server/tenancy/`.
- [x] Run `pnpm test:tenancy` and `pnpm db:validate:strict`.

#### P1-02 - Venues

- [x] Add nullable tenant/brand/settings/archive fields to existing `locations` (migration `0007_venue_resource_catalog`).
- [x] Backfill Hurlingham to PlayTT tenant/brand without changing id or slug.
- [x] Add `src/server/catalog/` venue mapper for domain naming.

#### P1-03 - Zones, resource types, and capabilities

- [x] Add `zones`, `resource_types`, and `resource_capabilities` additively.
- [x] Add nullable tenant/zone/resource-type/code/ruleset/configuration fields to existing `resources`; retain legacy type during transition.
- [x] Seed Main Hall, `table_tennis_table`, `tt_standard_v1`, and scoring/replay/access/lighting/display/camera capabilities.
- [x] Run `pnpm test:catalog` and `pnpm db:validate:strict`.

#### P1-04 - Expand tenant scope to commercial tables

- [x] Add `feature_flags` and `audit_logs` additively (migration `0008_tenant_scope_expand`).
- [x] Add tenant scope to tenant-owned tables in parent-first dependency order.
- [x] Backfill via `db/backfill-tenant-scope.sql` through authoritative parent joins.
- [x] Add tenant-leading indexes, `bookings (tenant_id, id)` parent key, and NOT VALID composite FKs.
- [x] Validate constraints and enforce `tenant_id NOT NULL` with PlayTT default (migration `0009_tenant_scope_enforce`).
- [x] Run `pnpm test:tenant-backfill` and `scripts/validate-tenant-backfill.mjs` against disposable DBs when available.

#### P1-08 - Model venue access points

- [ ] Add tenant/venue/optional-zone-scoped `access_points` for entrances, halls, and private resource doors.
- [ ] Add `access_point_resources` so one booking can require multiple doors and one shared entrance can serve multiple resources.
- [ ] Seed the Hurlingham entrance/access path without provider-specific lock IDs in booking code.
- [ ] Add operator configuration and authorization for access-point/resource mapping.

#### P1-04 - Enforce tenant/catalog integrity

- [x] Backfill venue/resource tenant scope from deterministic PlayTT records.
- [x] Backfill child tenant scope through authoritative parent joins, never user/client input.
- [x] Add tenant-leading indexes and parent `(tenant_id, id)` unique keys.
- [x] Add composite tenant/parent FKs as not-yet-validated, then validate in `0009`.
- [x] Run zero-null, orphan, and cross-tenant mismatch checks via `validate-tenant-backfill`.
- [x] Validate constraints, then set tenant fields non-null in `0009_tenant_scope_enforce`.

#### P1-05 - Add application tenant context and RBAC

- [ ] Resolve user tenant membership after Better Auth authentication.
- [ ] Resolve device tenant later from credential/assignment; define the context entry point now.
- [ ] Add centralized `authorize(action, scope)` and typed authorization errors.
- [ ] Require tenant context in every tenant-owned repository method.
- [ ] Apply tenant filters to catalog, bookings, payments, modifications, credits, sessions/events, matches, replays, Coach, and notifications.
- [ ] Add audit writes for privileged membership/catalog changes.

#### P1-07 - Maintain legacy clients

- [ ] Resolve the PlayTT tenant server-side for legacy routes and Server Actions.
- [ ] Preserve existing IDs, URLs, response envelopes, price/time shapes, and mobile booking adapters.
- [ ] Add versioned venue/resource endpoints as adapters over the same application services.
- [ ] Deliver new capability/tenant fields as optional until client minimum version advances.

#### P1-06 - Operator configuration

- [ ] Add protected operator shell and navigation.
- [ ] Implement tenant, membership, venue, zone, resource, resource-type, capability, and feature-flag views/actions.
- [ ] Hide/deny all operator UI and APIs for customer/support roles without permissions.

### Automated tests

- [ ] Every repository has same-tenant success and guessed cross-tenant denial tests.
- [ ] Tenant A cannot access Tenant B through direct ID, nested ID, query filter, booking relation, payment relation, media/replay, or operator action.
- [ ] Same human venue/resource code is valid in different tenants and rejected within its configured scope.
- [ ] Composite FK rejects a booking whose resource belongs to a different tenant/venue.
- [ ] Access points cannot map across tenants/venues; booking access resolution returns the exact ordered set of required doors.
- [ ] Backfill is resumable/idempotent and produces expected counts.
- [ ] Legacy response fixtures and released-mobile contract suite remain unchanged.
- [ ] RLS, if introduced, is tested using the actual production application role and confirms privileged bypass behavior is understood.

### Build and smoke tests

- [ ] Existing Hurlingham booking/payment journey passes without tenant input.
- [ ] Operator creates a second tenant, venue, zone, resource, access point, and resource-to-door mapping without code changes.
- [ ] Customer cannot open operator routes.
- [ ] Old mobile preview build works against tenant-aware staging.

### Rollout and rollback

- [ ] Deploy additive schema and dual-compatible code with tenant features disabled.
- [ ] Run and verify backfill before constraint validation/read switch.
- [ ] Enable internal operator accounts, then a staging tenant, then production PlayTT context.
- [ ] Roll back by disabling tenant-aware reads/operator features; retain additive data.

### Phase 1 exit

- [ ] All tenant-owned rows are scoped and constraints validated.
- [ ] Cross-tenant suite passes across every module.
- [ ] Legacy web/mobile contracts pass.
- [ ] Operator catalog configuration is permissioned and audited.

## Phase 2 - Payment hardening, play sessions, and durable events

### Preconditions

- [ ] Phase 1 exit signed.
- [ ] Event envelope, event catalog, retry/backoff limits, dead-letter ownership, and correlation rules approved.
- [ ] Operational session state machine and legal transitions approved.
- [ ] Worker deployment/scheduling mechanism selected for every environment.

### Build steps

#### P2-01 and P2-02 - Add inbox, outbox, and worker before producers

- [ ] Add `payment_webhook_inbox` with unique provider identity/payload hash, signature state, processing state, attempts, and errors.
- [ ] Add `outbox_events` with aggregate, tenant/venue/resource/session scope, event version, correlation/causation, availability, lease, attempts, processed/dead-letter state, and idempotency identity.
- [ ] Add worker claiming with bounded leases or `FOR UPDATE SKIP LOCKED`.
- [ ] Add consumer registry, exponential backoff, dead-letter visibility, and replay tooling.
- [ ] Deploy worker capable of safely ignoring unsupported event versions before any producer emits them.

#### P2-01 - Change webhook acknowledgement

- [ ] Verify Paystack HMAC over the raw body.
- [ ] Reject invalid signatures without inbox/domain mutation.
- [ ] Insert a valid event durably and idempotently before returning 2xx.
- [ ] Return retryable non-2xx if the inbox write fails.
- [ ] Process inbox rows through the worker; record final/retry/dead-letter outcomes.

#### P2-03 - Add operational sessions

- [ ] Add `play_sessions` with unique booking ID, tenant/venue/resource scope, state, scheduled/actual timestamps, correlation ID, and configuration snapshot/version.
- [ ] Add `session_participants` and nullable `play_session_id` compatibility links to matches, access credentials, current session events, and replays.
- [ ] Backfill sessions for existing paid confirmed/completed bookings using an idempotent upsert.
- [ ] Implement pure transition rules for held/confirmed/preparing/active/ending/completed/resetting/available semantics.

#### P2-04 - Make confirmation atomic

- [ ] Conditionally mark payment and booking once.
- [ ] Upsert the operational session once by booking ID.
- [ ] Write booking/payment history and versioned events in the same transaction.
- [ ] Preserve callback verification and current API/customer state.

#### P2-05 - Durable scheduling

- [ ] Schedule prepare/start/ending/complete/reset intents as durable work.
- [ ] Add periodic reconciliation for upcoming/running/stuck sessions.
- [ ] Make all lifecycle actions conditional/idempotent and record actor/cause/correlation.
- [ ] Expose session state additively to web/mobile; keep polling fallback.

#### P2-06 and P2-07 - Move side effects and preserve projections

- [ ] Move confirmation email behind the outbox only after its consumer is deployed and idempotent.
- [ ] Preserve booking/payment response shapes, callback reconciliation, payment polling, and released-mobile fixtures.

### Automated tests

- [ ] Valid, invalid, malformed, duplicate, concurrent, delayed, and reordered webhook fixtures.
- [ ] Exactly one payment transition, booking confirmation, play session, history record, and logical outbox event.
- [ ] Crash after inbox insert, after domain commit, during consumer work, and before acknowledgement recovers correctly.
- [ ] Worker lease expiry, concurrent claims, retry/backoff, dead-letter, and manual replay behavior.
- [ ] Every illegal session transition is rejected; every legal transition is idempotent.
- [ ] Reconciler recreates missed work and does not duplicate completed work.
- [ ] Existing callback polling, booking expiry, cancellation, and modification payment regression suite passes.

### Build and smoke tests

- [ ] Paystack test checkout confirms only after server verification.
- [ ] Session timeline appears for a confirmed booking.
- [ ] Worker restart during processing completes after recovery.
- [ ] Old mobile build continues payment polling and renders new optional fields safely.

### Rollout and rollback

- [ ] Deploy inbox/outbox/worker first with producers disabled.
- [ ] Shadow-write inbox/outbox and compare outcomes before switching acknowledgement/consumers.
- [ ] Enable internal Paystack events, then test transactions, then production cohort.
- [ ] Roll back by disabling consumers/new projections; never delete durable inbox/outbox/session records.

### Phase 2 exit

- [ ] Payment/session/outbox atomicity and crash recovery suites pass.
- [ ] Worker monitoring and dead-letter ownership are live.
- [ ] Existing web/mobile checkout remains compatible.
- [ ] Durable lifecycle reconciliation is proven across restart.

## Phase 3 - Devices, ESP32 scoring, and realtime

### Preconditions

- [ ] Phase 2 exit signed.
- [ ] Device credential format, issuance display, storage, rotation, revocation, and rate limits approved.
- [ ] HTTPS device v1 payloads and firmware compatibility policy frozen.
- [ ] `tt_standard_v1` scoring rules and correction policy approved.

### Build steps

#### P3-01/P3-02/P3-03/P3-04 - Device registry, assignments, health, commands, and security

- [ ] Add devices, hashed/versioned credentials, one-time enrollments, assignments, latest health/sampled heartbeat, commands, and acknowledgement state.
- [ ] Include `ttlock_lock` and `ttlock_gateway` device types so Phase 5 can inventory and assign access hardware without a parallel registry.
- [ ] Enforce tenant/venue ownership and time-aware unique active assignment rules.
- [ ] Implement provision/config/heartbeat/events/command-ack endpoints with dedicated device authentication.
- [ ] Add credential rotation/revocation and rate limits.
- [ ] Add audit/correlation for enrollment, assignment, command, and credential actions.

#### P3-08 - Firmware and simulator

- [ ] Add `firmware/esp32-controller/` without reorganizing existing apps.
- [ ] Implement provisioning mode, protected credential storage, TLS, heartbeat, configuration version, physical debounce, boot/sequence identity, ordered offline event buffer, retries, and command acknowledgement.
- [ ] Provide a command-line/device simulator that implements the same protocol and failure modes.
- [ ] Define signed OTA workflow; stage Secure Boot/flash encryption certification for production hardware.

#### P3-05 and P3-06 - Authoritative scoring and sport rules

- [ ] Add immutable score events unique by device/boot/sequence or idempotency key.
- [ ] Add versioned score snapshots and match/play-session linkage.
- [ ] Validate active session, assignment, capability, side, delta, sequence, and correction permissions.
- [ ] Apply `SportRulesAdapter` and update event/snapshot/outbox atomically.
- [ ] Preserve current activity/match reads through compatibility projections.

#### P3-07 - Realtime and displays

- [ ] Implement provider-neutral broadcaster and scoped tenant/venue/resource/session channels.
- [ ] Publish only after database commit/outbox processing.
- [ ] Implement kiosk/tablet and TV read models with initial snapshot, version checks, reconnect, and refetch.
- [ ] Use Redis presence/Pub/Sub only as an optional ephemeral adapter.

### Automated tests

- [ ] Enrollment one-time use, expiry, wrong hardware UID observation, credential rotation/revocation, and rate limits.
- [ ] Assignment overlap/conflict and correct reassignment without firmware changes.
- [ ] Wrong tenant/venue/resource/role/session and expired command requests are rejected.
- [ ] Duplicate, retried, concurrent, out-of-order, buffered, and corrected score events produce legal exactly-once results.
- [ ] Score event, snapshot, and outbox are atomic under failure.
- [ ] Displays converge after missed messages; Redis loss preserves database ingestion/truth.
- [ ] Table/device isolation under concurrent sessions.

### Hardware and smoke tests

- [ ] Simulator completes provision -> config -> heartbeat -> score -> command ack.
- [ ] Physical ESP32 completes the same suite over venue-like Wi-Fi/TLS.
- [ ] WAN interruption buffers and replays events in order without duplicates.
- [ ] Two browsers/tablet/TV show the same snapshot after reconnect.
- [ ] Offline-device alert identifies the correct resource only.

### Rollout and rollback

- [ ] Enable simulator tenant first, then one staging device, then Table 01.
- [ ] Keep scoring/realtime flags per tenant/venue/resource.
- [ ] Roll back by disabling ingestion/projections while retaining device registry and committed events.

### Phase 3 exit

- [ ] Simulator and physical ESP32 protocol suites pass.
- [ ] Exactly-once score behavior and display convergence are proven.
- [ ] Redis/realtime failure does not corrupt session state.
- [ ] Device fleet health and audit are operational.

## Phase 4 - Private R2 media foundation

### Preconditions

- [ ] Phase 2 exit signed; tenant/venue/resource/session scope is stable.
- [ ] Separate private R2 buckets/tokens for dev, staging, and production exist.
- [ ] Media kinds, content policies, retention classes, deletion workflow, and object-key convention approved.

### Build steps

#### P4-01 and P4-02 - Metadata and adapter

- [ ] Add `media_assets` with ownership/scope, immutable key, type, size, checksum, status, retention, upload/delete timestamps.
- [ ] Add `MediaStore` fake and R2 implementation with adapter contract tests.
- [ ] Add optional media linkage to current replay records.
- [ ] Represent existing URLs as explicit legacy/external assets; never relabel them as R2 objects.

#### P4-05 - Preserve replay compatibility

- [ ] Keep current replay credit, purchase, list, and activity response contracts while storage internals change.
- [ ] Read legacy URLs only behind an explicit migration flag until objects are migrated and verified.

#### P4-03 and P4-04 - Secure grants and completion

- [ ] Generate object keys server-side.
- [ ] Authorize tenant/user/session/operation before issuing one exact-key short-lived PUT or GET grant.
- [ ] Sign/validate expected content type and enforce size/checksum policy at completion.
- [ ] Process upload/delete events through idempotent inbox/outbox semantics.
- [ ] Add deletion intent, retry, completion, and audit.

#### P4-06 - Infrastructure policy

- [ ] Disable public access and development public URLs.
- [ ] Scope credentials to the environment bucket and required operations.
- [ ] Configure exact production CORS and required methods/headers only.
- [ ] Configure lifecycle rules by prefix/retention class.
- [ ] Add DB-to-R2 reconciliation and alerts.

### Automated tests

- [ ] Same-owner authorized upload/download and all guessed cross-user/tenant/session negatives.
- [ ] Exact object key, operation, expiry, content type, size/checksum, and replayed grant behavior.
- [ ] Duplicate/reordered upload callbacks and delete retries.
- [ ] R2 outage, lost callback, orphan metadata, missing object, unexpected object, and partial upload recovery.
- [ ] Secret/client bundle scan and API/log redaction.
- [ ] Existing replay credit/purchase/list contract regression.

### Staging and smoke tests

- [ ] Browser/mobile can play an authorized clip through short-lived access.
- [ ] Expired URL fails and a newly authorized request succeeds.
- [ ] Another user/tenant with the URL or media ID is denied after expiry and through the API.
- [ ] Lifecycle and deletion actions reconcile with database state.

### Rollout and rollback

- [ ] Enable internal media cohort in dev/staging, then production internal users.
- [ ] Keep current replay projection/API while switching storage internals.
- [ ] Roll back grants/adapter with the flag; retain asset state for retry/reconciliation.

### Phase 4 exit

- [ ] Private storage/security suite passes.
- [ ] No credentials/public media path is exposed.
- [ ] Upload, playback, deletion, and reconciliation are observable and idempotent.

## Phase 5 - TTLock access and venue automation

### Preconditions

- [ ] Phases 2 and 3 exit signed.
- [ ] Provider/device capability and configuration records exist for the pilot venue.
- [ ] Manual fallback, emergency contacts, access window, grace period, and safety policies are approved.
- [ ] Separate TTLock Open Platform applications/accounts or approved tenant connections exist for development, staging, and production.
- [ ] Pilot locks support remote custom timed passcodes and are online through commissioned TTLock gateways.
- [ ] Venue access-point/resource mappings and lock/gateway assignments are approved.

### Build steps

#### P5-01 - AccessProvider contract and simulator

- [ ] Define provision, modify validity, revoke, reconcile, health, and credential-status operations.
- [ ] Implement a simulator covering success, duplicate, timeout, terminal error, partial multi-door success, and provider drift.
- [ ] Keep booking/session orchestration provider-neutral and asynchronous.

#### P5-02 - TTLock connection, gateway, and lock inventory

- [ ] Implement server-only `TTLockAccessProvider` using TTLock Open Platform V3 behind `AccessProvider`.
- [ ] Store TTLock client credentials and access/refresh tokens encrypted per tenant connection/environment; never expose them to clients, firmware, or logs.
- [ ] Sync external lock IDs, models, passcode versions, MAC/firmware metadata, battery, clock/timezone, gateway association/reachability, and provider status.
- [ ] Register TTLock locks and gateways as device types; assign locks to access points and gateways to venues.
- [ ] Reject commissioning when a lock lacks compatible custom-passcode support or remote gateway delivery.
- [ ] Treat `(provider_connection_id, external_lock_id)` as the provider identity boundary.

#### P5-03 - Provision one booking code across required doors

- [ ] On `booking.confirmed.v1`, resolve the resource's required access points and each access point's active TTLock assignment.
- [ ] Generate one cryptographically secure eight-digit numeric code per booking and collision-check it on every target lock.
- [ ] Calculate `validFrom` and `validUntil` from venue timezone, early-entry policy, booking window, and grace period; send TTLock millisecond timestamps.
- [ ] Create the same custom timed passcode on every required lock through its gateway and persist each external passcode ID.
- [ ] Group per-door credentials into one booking access grant and reveal the code only after all required locks report success.
- [ ] If a required door fails, keep the grant non-revealable, retain idempotent retry state, alert operations, and invoke manual fallback instead of pretending access is ready.
- [ ] Encrypt the revealable code at application level; mask it in normal queries, logs, analytics, alerts, and operator lists.

#### P5-04 - Modify, revoke, and reconcile TTLock access

- [ ] Cancellation revokes/deletes every TTLock passcode for the booking.
- [ ] A time-only edit modifies supported credentials or safely provisions replacement validity before retiring obsolete state.
- [ ] A resource/venue edit resolves the new door set, provisions replacement access, and revokes codes from doors no longer required.
- [ ] Completion/expiry reconciles TTLock passcode state even though keypad validity naturally ends.
- [ ] Retry token expiry, rate limits, gateway/lock offline, clock skew, and transient TTLock errors with bounded backoff; mark unsupported hardware/configuration as terminal.
- [ ] Synchronize unlock records by external passcode identity for support/audit while redacting keypad codes.

#### P5-05 - Player access experience

- [ ] Replace deterministic preview codes with an optional backend access payload behind `liveAccess`.
- [ ] Reveal only to the authenticated booking owner after paid confirmation and complete TTLock provisioning.
- [ ] Show one code, the list of doors it opens, `Valid from`, `Valid until`, venue instructions, and pending/failed support state.
- [ ] Refresh provisioning, expiry, revocation, and booking-edit state; never cache a valid code beyond its authorization window.
- [ ] Remove or hide misleading preview credentials when live access rollout begins.

#### P5-06 - TTLock operator tools

- [ ] Add tenant/venue TTLock connection commissioning and token-health views.
- [ ] Add gateway/lock inventory, access-point assignment, custom-code capability, battery, clock/timezone, firmware, last sync, and status views.
- [ ] Add permissioned retry, reconcile, revoke, replacement-code, and incident/manual-fallback actions with reason and audit.
- [ ] Restrict remote unlock to venue manager or higher, require recent re-authentication and a reason, rate-limit it, and record the result; do not expose it as a customer action.
- [ ] Show redacted unlock/invalid-code/tamper records when supported without exposing stored credentials.

#### P5-07 and P5-08 - Relays and notifications

- [ ] Implement simulator and first production `RelayProvider` independently of TTLock provisioning.
- [ ] Convert session prepare/warn/end/reset intents into expiring idempotent relay commands with retry/ack/audit.
- [ ] Add push permission/token registration and access-ready, session reminder, warning, end, and access-failure notifications with polling fallback.

### Automated tests

- [ ] `AccessProvider`, TTLock, and relay contracts cover provision, modify, revoke, reconcile, time/grace calculations, and error mapping.
- [ ] Tenant/provider connection and venue/access-point/lock isolation prevent codes from reaching unrelated doors.
- [ ] Code generator produces eight-digit numeric values, handles per-lock collisions, and never logs plaintext.
- [ ] Duplicate confirmation/retry creates one external passcode per required lock and one booking-level access grant.
- [ ] Partial multi-door success remains hidden, retries only missing work idempotently, and reaches all-ready or visible terminal/manual state.
- [ ] Cancellation, reschedule, venue/resource change, expiry, duplicate revoke, and provider drift converge to expected TTLock state.
- [ ] TTLock token expiry, rate limit, gateway offline, lock offline, low battery, clock skew, unsupported passcode version, and provider outage never roll back booking/payment/session.
- [ ] Duplicate command, replay, expiry, duplicate/late ack, and wrong-target relay behavior.
- [ ] Pending/cancelled/expired/wrong-user bookings cannot retrieve credentials.
- [ ] Tenant A cannot view/manage Tenant B TTLock connection, gateway, lock, code, access point, or unlock record.
- [ ] Notification token rotation, duplicate event suppression, preference handling, and polling fallback.
- [ ] Every manual/remote unlock requires permission, recent re-authentication, reason, rate limit, and audit/correlation.

### Hardware and mobile tests

- [ ] Simulator completes paid confirmation -> resolve doors -> provision one code -> reveal -> use -> reschedule -> revoke -> relay reset.
- [ ] Pilot TTLock gateway remotely creates the custom timed code on the physical lock; the keypad accepts it only inside the configured window and rejects it before/after.
- [ ] One booking requiring two test locks receives one code that opens both; an unrelated venue/resource lock rejects it.
- [ ] Gateway disconnect/reconnect, token refresh, low battery warning, clock skew, API retry, partial multi-lock failure, and reconciliation runbooks pass.
- [ ] Cancellation and venue/resource edits revoke obsolete physical-door access.
- [ ] Mobile standalone builds test access pending/ready/failed, reveal/copy, door list, offline refresh, booking edit, revoke, expiry, and notification lifecycle states.
- [ ] Operator recovers a TTLock outage and performs a restricted audited remote unlock through the runbook.

### Rollout and rollback

- [ ] Commission TTLock development connection and simulator, staging gateway/lock, then one internal Hurlingham/Table 01 booking before a pilot cohort.
- [ ] Enable `liveAccess` only after connection, gateway, lock, clock, battery, create/use/revoke, and unlock-record commissioning passes for that venue.
- [ ] Maintain independent access, lighting, and notification flags.
- [ ] Roll back to manual operations without disabling booking/payment/session.

### Phase 5 exit

- [ ] One individual booking code works across all required TTLock doors and nowhere else during exactly the configured window.
- [ ] Physical TTLock provision/modify/revoke/reconcile and relay lifecycle/failure recovery pass.
- [ ] No fake or unauthorized credential is exposed.
- [ ] TTLock/gateway outage, partial door failure, and manual fallback are observable, safe, and audited.

## Phase 6 - Replay edge pipeline

### Preconditions

- [ ] Phases 3 and 4 exit signed.
- [ ] Pilot camera/resource assignments, replay entitlement, clip window, retention, and privacy policy approved.
- [ ] Venue edge host and local stream access are available without exposing camera management to public networks.

### Build steps

#### P6-01 and P6-02 - Request and edge protocol

- [ ] Add `replay_requests` with tenant/venue/resource/play-session/requester scope, selected source, requested window, status, attempts, correlation, media ID, and idempotency identity.
- [ ] Backfill compatibility request records for existing replay projections where useful.
- [ ] Define `VideoAdapter`/edge protocol for config, health, request, extraction, upload, acknowledgement, and failure.
- [ ] Reuse fixed request/media/object identities on retries.

#### P6-03 - Prototype capture

- [ ] Implement one-table rolling buffer on a development edge host.
- [ ] Select camera through assignments/capabilities, not hard-coded app addresses.
- [ ] Extract configured pre/post-roll, obtain exact R2 upload grant, upload directly, and acknowledge.
- [ ] Mark media ready only after verified completion; update existing replay/activity projection.

#### P6-04/P6-05/P6-06 - Multi-resource configuration, playback, and recovery

- [ ] Configure edge/camera assignments for ten resources.
- [ ] Add local concurrency/CPU/disk/network limits, queueing, retention, and backpressure.
- [ ] Keep continuous security recording separate from user replay capture.
- [ ] Add edge offline/reconnect/status and operator retry/cancel tools.

### Automated tests

- [ ] Active-session, owner/device, entitlement/credit, tenant/resource, time-window, and rate-limit authorization.
- [ ] Duplicate button/API request, edge retry, upload callback race, and worker retry create one logical asset.
- [ ] Wrong camera/resource/tenant and expired command/grant are rejected.
- [ ] Edge disconnect, process restart, missing buffer, extraction failure, R2 outage, and callback loss recover or fail visibly.
- [ ] Ten-resource selection produces no session/camera/media cross-talk.
- [ ] Booking/payment/session completion continues during replay failure.

### Hardware and smoke tests

- [ ] Physical replay input produces a valid clip for the active Table 01 session.
- [ ] Authenticated player sees ready clip through short-lived playback; other users are denied.
- [ ] Edge offline queue resumes with the same IDs after reconnect.
- [ ] Representative simultaneous multi-table requests meet measured latency/resource limits.

### Rollout and rollback

- [ ] Enable development edge, staging Table 01, internal production sessions, then selected resources.
- [ ] Keep capture flags per tenant/venue/resource and a production kill switch.
- [ ] Roll back by disabling new requests; preserve pending requests/assets for explicit retry/cancel.

### Phase 6 exit

- [ ] End-to-end capture, private upload, playback, idempotency, isolation, and recovery pass.
- [ ] Production stub is disabled.
- [ ] Multi-resource edge capacity is measured and documented.

## Phase 7 - Operations and scale certification

### Preconditions

- [ ] Phases 5 and 6 exit signed for the pilot resource.
- [ ] On-call ownership, escalation contacts, SLOs, data retention, and incident severity policy approved.
- [ ] Venue network design and equipment capacity are reviewed against measured camera/device traffic.

### Build steps

#### P7-01 and P7-02 - Operational control plane, alerts, and runbooks

- [ ] Build tenant/venue overview with internet, NVR/edge, device, resource, session, automation, replay, and worker health.
- [ ] Add correlated payment -> booking -> session -> command/device/media timeline.
- [ ] Add alerts for device offline, webhook failure, stuck session, automation failure, replay backlog, worker dead letter, DB/Redis/R2 health, and storage retention.
- [ ] Link each alert to an owned recovery runbook and audited support action.

#### P7-03 - Environment and disaster recovery

- [ ] Verify database, R2, Redis, payment, device, and realtime isolation across dev/preview/staging/production.
- [ ] Rehearse database backup/restore, schema migration rollback strategy, R2 reconciliation/deletion recovery, secret rotation, and credential revocation.
- [ ] Define recovery objectives and record measured results.

#### P7-04 - Venue network and fleet certification

- [ ] Implement management, camera, IoT, display, staff, and guest VLAN/firewall policies.
- [ ] Verify guest/IoT cannot reach camera or management planes beyond approved paths.
- [ ] Confirm continuous camera traffic stays local and NVR/edge/switch capacity meets measured load.
- [ ] Document DHCP reservations/DNS/registry discovery and eliminate hard-coded IPs from application/firmware logic.

### P7-05 and P7-06 acceptance suites

#### Single-table

- [ ] Web/mobile booking and Paystack confirmation create one play session.
- [ ] Confirmation provisions the booking's individual code through the assigned TTLock gateway; the code opens every required door only during its valid window.
- [ ] Prepare actions execute or fail safely; ESP32 reports online/configured.
- [ ] Score input applies once; kiosk/TV converge.
- [ ] Replay creates one private playable asset.
- [ ] End closes scoring, expires access, resets resource, and completes timeline.

#### Ten-table venue

- [ ] Create ten resources and assignments through configuration only.
- [ ] Configure shared venue entrances and resource-specific TTLocks; each booking code opens only its mapped doors.
- [ ] Run concurrent sessions without score/session/device/media cross-talk.
- [ ] One resource/device failure does not affect another.
- [ ] Realtime channels and edge camera selection stay resource/session scoped.
- [ ] Operations dashboard identifies the exact failing device/resource.
- [ ] Venue network isolation and measured camera/NVR/edge capacity pass.

#### Multi-tenant SaaS

- [ ] Guessed IDs cannot cross tenant boundaries in any API, repository, realtime channel, operator UI, media grant, or device path.
- [ ] Tenant TTLock accounts, gateways, locks, passcodes, and unlock records remain isolated even when external lock IDs or human door codes overlap.
- [ ] Tenants may reuse human codes safely.
- [ ] Branding, rules, capabilities, retention, and feature rollout differ through configuration.
- [ ] Add a `golf_bay` resource type without changing booking/payment core logic.
- [ ] Media ownership and every download remain database-authorized.

#### Failure and recovery

- [ ] Restart application/worker during webhook, session transition, command, and replay processing.
- [ ] Exercise Redis, R2, provider, device, edge, venue WAN, and selected database failover/outage scenarios.
- [ ] Rotate Paystack/R2/device credentials without exposing secrets or corrupting in-flight work.
- [ ] Restore a backup into an isolated environment and pass migration/smoke checks.

### P7-07 rollout

- [ ] Internal staff accounts and simulator environment.
- [ ] Preview/staging with Paystack test and selected hardware.
- [ ] Pilot Table 01 sessions with operators present.
- [ ] Progressive resource rollout at the first venue.
- [ ] Ten-table certification and stable observation window.
- [ ] Second venue/tenant pilot.
- [ ] General availability only after all acceptance evidence and runbook ownership are complete.

### Program exit

- [ ] All acceptance suites pass with linked evidence.
- [ ] Security review has no unresolved critical/high issue.
- [ ] SLOs, alerts, support ownership, rollback, and manual fallback are live.
- [ ] The booking/payment-only safe mode is documented and tested.
- [ ] Future service extraction is deferred until measured bottlenecks justify it.
