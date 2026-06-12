# Coach and Replay Credits

Canonical spec for the Coach tab, replay clip packs, and Coach subscription. Read this before changing coach/replay surfaces.

## Register

product (mobile app + API)

## Product model

Two **independent** paid products:

| Product | Type | What it unlocks |
|---------|------|-----------------|
| **Replay clip pack** | One-time (Paystack) | 10 credits to trigger in-venue instant replays |
| **Coach subscription** | Recurring (Paystack) | Analysis of captured clips + personalized training guidance |

Rules:

- Anyone with credits can capture replays; clips appear in **Activity → Highlights**.
- Coach subscription does **not** include replay credits.
- Coach insights only generate for **ready** replays when the user has an **active** Coach subscription.
- No credits → replay button at venue is blocked with a calm buy-credits path.

Configurable pricing (server constants, not hardcoded in UI):

- `REPLAY_PACK_CREDITS` = 10
- `REPLAY_PACK_PRICE_KES` — ops decision
- `COACH_MONTHLY_PRICE_KES` — ops decision

---

## Information architecture

### Bottom tabs (5)

| Tab | Route | Purpose |
|-----|-------|---------|
| Home | `(tabs)/index` | Booking-first |
| Bookings | `(tabs)/bookings` | Sessions |
| Activity | `(tabs)/activity` | Watch replays + stats; clip balance |
| **Coach** | `(tabs)/coach` | Subscription, insights, training |
| Account | `(tabs)/account` | Settings; manage Coach billing link |

### Stack screens

| Screen | Route | Data |
|--------|-------|------|
| Buy clip pack | `(app)/coach/buy-replays` | live / preview |
| Subscribe | `(app)/coach/subscribe` | live / preview |
| Insight detail | sheet from Coach tab | live / preview |

---

## End-to-end flows

### Buy clip pack

1. Player taps **Buy clips** (Activity intro or Coach).
2. Bottom sheet: `10 clip pack · KES X`.
3. `POST /api/replays/credits/purchase` → Paystack hosted checkout.
4. Webhook credits ledger `+10`.
5. Activity intro updates balance.

### Subscribe to Coach

1. Player taps **Start Coach** on Coach tab.
2. Full screen or sheet: plan summary + monthly price.
3. `POST /api/coach/subscribe` → Paystack subscription.
4. Webhook sets `coach_subscriptions.status = active`.

### In-session replay capture

1. Player presses Replay button (pod or app) during confirmed booking.
2. `POST /api/replays/request` with `bookingId`.
3. Server validates: active booking, user is booker, `balance > 0`.
4. Atomic transaction: decrement credit, insert ledger, insert `replays` row (`queued`).
5. NVR worker clips video → `ready`.
6. Push: *"Your clip is ready"*.

If no credits: pod shows calm message; app deep-links to buy pack.

### Coach analysis (post-replay)

1. `replays.status` → `ready`.
2. If `coach_subscriptions.status = active`, enqueue analysis job.
3. Worker writes `coach_insights` + `coach_training_items`.
4. Push: *"New insight from your coach"* (`coach_insight_ready`).

---

## UX design

### Coach tab shell

Mirror Activity layout:

- Intro band: one-line intro + Preview badge (pre-live).
- Segment control: **Insights** | **Training**.
- Subscription band when inactive: `Start Coach` + price.
- Insight detail in bottom sheet (not chat UI).

### Activity tab changes

- Intro band: `N clips left` + tappable **Buy clips**.
- Replay rows: subtle **Reviewed** when coach analyzed (subscribers only).

### Copy standards

| Context | Copy |
|---------|------|
| Clip balance | `7 clips left` |
| Buy pack CTA | `Buy clips` |
| Pack sheet title | `10-clip pack` |
| Coach inactive | `Coach reviews your clips and suggests what to practice` |
| Coach CTA | `Start Coach` |
| No credits at venue | `You need clip credits to capture a highlight` |
| No insights yet | `Play a session and capture a clip. Your first insight will appear here.` |

Say **Clip pack**, **Coach**, **Your entry code**. Never NVR, AI assistant, or resource jargon.

### Empty states

| State | Message | Action |
|-------|---------|--------|
| No clips, no replays | Capture highlights during your next session | Book a session |
| No clips, has replays | You're out of clip credits | Buy 10-clip pack |
| No Coach sub | Coach reviews your clips… | Start Coach |
| Sub, no insights | Play a session and capture a clip… | View Activity |

### Anti-patterns

- No chat-first coach UI, streaks, badges, KPI hero grids.
- No sparkles / purple AI-dashboard chrome.
- No hiding Preview badges during mock phase.

---

## API contract

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/replays/credits` | Balance + last purchase |
| POST | `/api/replays/credits/purchase` | Init Paystack one-time |
| GET | `/api/replays/mine` | User replay library |
| POST | `/api/replays/request` | Venue trigger; atomic debit |
| GET | `/api/coach/status` | Subscription + entitlements |
| POST | `/api/coach/subscribe` | Init Paystack subscription |
| POST | `/api/coach/cancel` | Cancel at period end |
| GET | `/api/coach/insights` | List insights |
| GET | `/api/coach/insights/[id]` | Detail + training items |
| GET | `/api/coach/training` | Active training rows |

Payment webhooks handle `product_type`: `booking` | `replay_pack` | `coach_subscription`.

Credit debit is **transactional**: `SELECT balance FOR UPDATE` → decrement → ledger → `replays` insert.

---

## Database tables

- `replay_credit_balances` — `user_id`, `balance`, `updated_at`
- `replay_credit_ledger` — audit: `delta`, `reason`, optional `booking_id`, `replay_id`, `payment_id`
- `coach_subscriptions` — Paystack subscription state
- `coach_insights` — linked to `replay_id`, `booking_id`
- `coach_training_items` — drills linked to insights

Existing `replays` table unchanged; traceability via ledger metadata.

---

## Mock data contract

1. Modules: `lib/mock/mock-coach.ts`, `lib/mock/mock-replay-credits.ts`.
2. Gated by `USE_MOCK_PLAYER_DATA` in `mock-config.ts`.
3. Coach surfaces: **Preview** badge. Replay clips: **Sample** badge.
4. Purchase CTAs disabled with Preview label until live Paystack ships.

---

## Implementation phases

| Phase | Scope |
|-------|--------|
| 0 | This doc + USER.md + ux-blueprint updates |
| 1 | Coach tab UI shell, mocks, Activity balance, preview purchase screens |
| 2 | Drizzle schema, APIs, Paystack pack + subscription webhooks |
| 3 | `POST /api/replays/request`, venue validation, NVR hook stub |
| 4 | Coach analysis worker, live insights |

---

## Related docs

- [USER.md](../USER.md) — player IA
- [ux-blueprint.md](./ux-blueprint.md) — Coach Blueprint
- [PRODUCT.md](../PRODUCT.md) — brand principles
- [../../docs/requirements.md](../../../docs/requirements.md) — SRS replay requirements
