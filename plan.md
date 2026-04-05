# PlayTT Booking Implementation Plan

## Goal
Build the PlayTT booking flow end to end, starting with the database schema and core booking domain, then layering in payments, confirmation, access control, and session lifecycle automation.

## What The Docs Say
- Booking is the system backbone.
- A booking starts as `pending`.
- Payment confirmation moves it to `confirmed`.
- A confirmed booking triggers access generation.
- Session lifecycle automation hangs off booking times:
  - lights on shortly before start
  - warning near end
  - access expires at end
  - lights off after session
- The app is single-location MVP first, but must be structured for multi-location growth using `location_id`.

## Working Assumptions
- We will use PostgreSQL + Drizzle as the source of truth.
- We will model payment as a provider-agnostic domain, even if the first provider is Paystack handling M-Pesa / mobile money flows.
- We will implement the booking engine first, then connect provider and hardware integrations through clean service boundaries.
- We will optimize first for one active location, but every core table will still be multi-location safe.

## Delivery Order

### Phase 0: Foundation Alignment
Purpose: lock down domain language before coding.

Deliverables:
- final booking statuses
- final payment statuses
- time-slot rules
- pricing rules
- schema naming conventions
- service boundaries for payments, access control, and automation

Decisions to lock:
- booking duration options: 30 and 60 minutes
- booking timezone behavior
- grace period for door access: 5 minutes
- whether one booking is tied to one table/resource or one pod/session

### Phase 1: Database Schema First
Purpose: create the core data model that supports booking from reservation to session completion.

Deliverables:
- Drizzle schema in [db/schema.ts](/C:/Users/Idris Kulubi/Desktop/sidequests/playtt/playtt/db/schema.ts)
- initial migrations
- seed strategy for first location and first resource
- enum definitions and constraints

Core tables to create first:
- `users`
- `locations`
- `resources`
- `bookings`
- `booking_participants` if we want shared bookings later
- `payments`
- `booking_status_history`
- `hardware_configs`
- `access_credentials`
- `session_events`
- `matches`
- `replays`
- `notifications`

Recommended booking-centered schema shape:

1. `users`
- `id`
- `phone`
- `email`
- `name`
- `skill_level`
- `auth_provider`
- `created_at`
- `updated_at`

2. `locations`
- `id`
- `name`
- `slug`
- `address`
- `timezone`
- `is_active`
- `created_at`
- `updated_at`

3. `resources`
- `id`
- `location_id`
- `name`
- `type`
- `capacity`
- `is_active`
- `created_at`
- `updated_at`

4. `bookings`
- `id`
- `location_id`
- `resource_id`
- `user_id`
- `status` (`pending`, `confirmed`, `cancelled`, `expired`, `completed`, `failed`)
- `payment_status` (`unpaid`, `pending`, `paid`, `failed`, `refunded`, `partially_refunded`)
- `start_time`
- `end_time`
- `duration_minutes`
- `currency`
- `subtotal_amount`
- `discount_amount`
- `total_amount`
- `pricing_rule_snapshot`
- `notes`
- `confirmed_at`
- `cancelled_at`
- `expires_at`
- `created_at`
- `updated_at`

5. `payments`
- `id`
- `booking_id`
- `location_id`
- `user_id`
- `provider`
- `provider_reference`
- `provider_event_id`
- `amount`
- `currency`
- `status`
- `payment_method`
- `paid_at`
- `raw_payload`
- `created_at`
- `updated_at`

6. `booking_status_history`
- `id`
- `booking_id`
- `from_status`
- `to_status`
- `reason`
- `metadata`
- `created_at`

7. `hardware_configs`
- `id`
- `location_id`
- `provider_type`
- `config_key`
- `encrypted_value`
- `is_active`
- `created_at`
- `updated_at`

8. `access_credentials`
- `id`
- `booking_id`
- `location_id`
- `provider`
- `credential_type`
- `access_code`
- `external_reference`
- `valid_from`
- `valid_until`
- `status`
- `created_at`
- `updated_at`

9. `session_events`
- `id`
- `booking_id`
- `location_id`
- `event_type`
- `status`
- `payload`
- `triggered_at`
- `created_at`

Schema rules we should enforce:
- every core operational table includes `location_id`
- no overlapping confirmed bookings for the same `resource_id`
- bookings cannot have `end_time <= start_time`
- payment webhooks must be idempotent using provider event/reference uniqueness
- access credentials must be traceable back to one booking

Important DB design note:
- PostgreSQL exclusion constraints or equivalent locking strategy should be used to prevent double-booking at the database level.

### Phase 2: Booking Engine APIs
Purpose: make slot discovery and booking creation work before payment confirmation.

Deliverables:
- availability query service
- booking quote calculator
- create-pending-booking endpoint
- hold / expiry behavior for unpaid bookings
- booking detail endpoint

Endpoints to build:
- `GET /api/locations`
- `GET /api/locations/:id/availability?date=...`
- `POST /api/bookings/quote`
- `POST /api/bookings`
- `GET /api/bookings/:id`
- `POST /api/bookings/:id/cancel`

Core logic:
- only show valid 30-minute aligned slots
- apply peak/off-peak pricing rules
- create booking in `pending`
- reserve safely with transaction logic
- give pending bookings a short payment window

### Phase 3: Payments Integration
Purpose: move bookings from `pending` to `confirmed` safely.

Deliverables:
- payment initialization endpoint
- hosted checkout or STK/mobile money trigger flow
- webhook endpoint
- idempotent payment reconciliation
- booking confirmation transaction

Endpoints to build:
- `POST /api/payments/initialize`
- `POST /api/payments/webhook`

Core rules:
- never confirm directly from client-side success callbacks
- only webhook or verified server-side reconciliation can mark payment as paid
- booking confirmation must be transactional:
  - mark payment paid
  - mark booking confirmed
  - write status history
  - enqueue access generation
  - enqueue notifications

### Phase 4: Access Control Integration
Purpose: generate booking-bound entry credentials once payment succeeds.

Deliverables:
- access generation service
- provider abstraction for TTLock
- booking access card payload for UI
- manual admin override support later

Core workflow:
- on booking confirmation, create time-bound PIN/eKey
- validity = booking start minus optional early-entry window through booking end plus 5 minutes
- persist external references and status
- expose access details on the booking details endpoint

### Phase 5: Session Lifecycle Automation
Purpose: make the physical session respond automatically to booking time.

Deliverables:
- scheduled jobs or worker handlers
- pre-session lighting trigger
- 5-minute warning trigger
- session-end cleanup trigger
- session event logging

Automation timeline:
- T-2 min: lights on
- T-5 min before end: flash lights and send warning notification
- T end: mark access expired
- T+1 min: lights off if no active extension

### Phase 6: In-Session Experience
Purpose: support the live scoreboard and later replay linkage.

Deliverables:
- active session endpoint
- match state persistence
- WebSocket events for score sync
- replay trigger model tied to active booking

Tables used heavily here:
- `matches`
- `session_events`
- `replays`

### Phase 7: Admin Operations
Purpose: handle edge cases and operator controls.

Deliverables:
- booking search
- payment verification tools
- force confirm flow with audit trail
- remote unlock action with audit trail
- refund support

## Suggested Build Sequence Inside The Codebase

1. Complete [db/schema.ts](/C:/Users/Idris Kulubi/Desktop/sidequests/playtt/playtt/db/schema.ts).
2. Add Drizzle migration setup and generate the first migration.
3. Seed the first location: Hurlingham.
4. Seed the first resource for that location.
5. Add booking domain types and status enums.
6. Build slot availability logic.
7. Build `create booking` and `get booking` APIs.
8. Add pricing service.
9. Add payment initialization and webhook handling.
10. Add confirmation workflow and access generation stub.
11. Add automation job handlers.
12. Add admin support tools.

## First Coding Sprint We Should Execute
This is the immediate sprint I recommend we follow now.

### Sprint 1 Objective
Create a trustworthy booking data foundation.

### Sprint 1 Tasks
- define all booking-related enums
- implement core tables in Drizzle
- add indexes and uniqueness constraints
- design anti-double-booking strategy
- create initial migration
- add a seed script for one location and one table/pod
- document booking lifecycle states

### Sprint 1 Exit Criteria
- schema is committed
- migrations run successfully
- first location and resource can be seeded
- a booking record can represent the full lifecycle from `pending` to `completed`
- payment and access records can attach cleanly to one booking

## Risks To Watch Early
- docs mention both M-Pesa-first language and Paystack as gateway; we should model payment provider cleanly to avoid lock-in
- resource modeling must be decided early: per table vs per pod
- booking overlap prevention must live in the database, not only in UI logic
- timezone handling must be explicit from day one
- hardware credentials must never be hardcoded into route handlers

## Definition Of Done For End-to-End Booking
A user should be able to:
- sign in
- see available slots for a location
- create a pending booking
- pay successfully
- have the booking become confirmed
- receive an access credential tied to that booking
- enter the pod during the allowed time window
- receive session warnings and post-session follow-up

## Immediate Next Step
Start implementing Phase 1 by designing and coding the Drizzle schema in [db/schema.ts](/C:/Users/Idris Kulubi/Desktop/sidequests/playtt/playtt/db/schema.ts), beginning with:
- `locations`
- `resources`
- `users`
- `bookings`
- `payments`
- `access_credentials`
