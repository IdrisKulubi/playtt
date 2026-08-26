# PlayTT User Experience (Mobile)

## Register

product (mobile app, player-facing)

## Audience

End-user **players** only. Admin and ops surfaces live on the web app.

## Completion bar (pre-hardware)

> A player can manage their full PlayTT life in-app — book, pay, review history, reveal authorized venue access, and adjust server-backed notification preferences.

---

## Jobs to be done

| Job | Success looks like |
|-----|-------------------|
| Get in and stay signed in | Auth, verify email, profile |
| Book and pay | [booking-ux.md](./design-system/booking-ux.md) |
| Manage upcoming sessions | View, edit, cancel unpaid hold, pay |
| Review past play | Past bookings list, session detail, receipt |
| Understand my activity | Stats dashboard (preview data until API) |
| Know how to enter the pod | Live access status, required doors, validity window, and explicit code reveal |
| Relive sessions | Replay library (sample clips until camera pipeline) |
| Capture highlights | Buy clip packs; trigger replays at venue (credits gate) |
| Improve with Coach | Home → Coach: interactive chat demo (preview), plus insights and training |
| Find a partner | Community tab: nearby players + match requests (preview) |
| Control preferences | Notification prefs stub, help, legal, sign out |

---

## Information architecture

### Bottom tabs (5)

| Tab | Route | Purpose |
|-----|-------|---------|
| **Home** | `(tabs)/index` | Play sub-tab: next session hero, book CTA, quick links. Coach sub-tab: **Chat** (preview), Insights, Training |
| **Bookings** | `(tabs)/bookings` | Upcoming \| Past segments → detail sheet |
| **Activity** | `(tabs)/activity` | Highlights + stats; clip balance |
| **Community** | `(tabs)/community` | Find players, open requests, request a match (preview) |
| **Account** | `(tabs)/account` | **Account** sub-tab: profile, security, sign out. **Settings** sub-tab: coach, notifications, help, legal, replay intro |

Home top sub-tabs (Uber-style): **Play** \| **Coach**. Coach is no longer a bottom tab; `(tabs)/coach` redirects to Home with `homeTab=coach`.

Account top sub-tabs: **Account** \| **Settings**. Coach link lives under Settings (`accountTab=settings` for deep links).

Floating liquid-glass bottom bar on all tab screens. Scroll content includes bottom clearance for the bar.

Stack screens (pushed from tabs):

| Screen | Route | Data |
|--------|-------|------|
| Book | `(app)/book` | live |
| Activity stats | `(app)/activity/stats` | mock |
| Activity replays | `(app)/activity/replays` | mock |
| Edit profile | `(app)/account/edit-profile` | live |
| Notifications | `(app)/account/notifications` | live preferences and Expo push registration |
| Help | `(app)/account/help` | static |
| Legal | `(app)/account/legal` | static |
| Buy clip pack | `(app)/coach/buy-replays` | live / preview |
| Subscribe to Coach | `(app)/coach/subscribe` | live / preview |

---

## Screen inventory

### Live data (P0)

| Surface | Source |
|---------|--------|
| Upcoming bookings | `GET /api/bookings/mine?filter=upcoming` |
| Past bookings | `GET /api/bookings/mine?filter=past` |
| Booking detail | `GET /api/bookings/[id]` |
| Booking access status | `GET /api/bookings/[id]/access` |
| Reveal booking access | `POST /api/bookings/[id]/access/reveal` |
| Cancel hold | `POST /api/bookings/[id]/cancel` (pending + unpaid only) |
| Edit booking | modifications API |
| Pay hold | payments API |
| Profile | `GET /api/user/me` |
| Replay credits | `GET /api/replays/credits` |
| Buy clip pack | `POST /api/replays/credits/purchase` |
| Replay library | `GET /api/replays/mine` |
| Coach status | `GET /api/coach/status` |
| Coach subscribe | `POST /api/coach/subscribe` |
| Coach insights | `GET /api/coach/insights` |
| Notification preferences | `GET/PATCH /api/user/notification-preferences` |
| Expo push device | `POST/DELETE /api/user/push-tokens` |

### Preview / mock data (P1)

| Surface | Module | Label in UI |
|---------|--------|-------------|
| Player stats | `lib/mock/mock-player-stats.ts` | "Preview" |
| Replay library | `lib/mock/mock-replays.ts` | "Sample" |
| Home stats teaser | mock-player-stats | "Preview" |
| Community players / requests | `lib/mock/mock-community.ts` | "Preview" |
| Clip balance | `lib/mock/mock-replay-credits.ts` | "Preview" |
| Coach insights / training | `lib/mock/mock-coach.ts` | "Preview" |
| Coach chat | `lib/mock/mock-coach-chat.ts` | "Preview" |

### Local/static support

| Surface | Storage |
|---------|---------|
| Help / FAQ | static copy |
| Legal | placeholder links |

---

## Mock data contract

1. All mock surfaces show a visible **Preview** or **Sample** badge — never hidden.
2. Mock modules live under `playtt-mobile/lib/mock/`.
3. `USE_MOCK_PLAYER_DATA` in `mock-config.ts` gates mock stats/replays (default `true`).
4. Entry codes are never mock data, cached persistently, logged, or placed in notification payloads.

---

## Copy rules

- Reuse [booking-ux.md](./design-system/booking-ux.md) for booking flows.
- Say **"Your entry code"**, not TTLock PIN or resource name.
- Empty states always include a next action (book, view upcoming, etc.).
- Cancel copy: *"Release this hold"* for unpaid pending bookings.

---

## Out of scope

- Bluetooth/mobile-key unlock (players use the keypad code)
- Lighting automation
- NVR replay upload (capture API + worker stub in place; full camera pipeline TBD)
- Admin analytics
- Phone OTP login

---

## Completion checklist

- [x] `USER.md` published (this file)
- [x] Bookings: Upcoming \| Past segments
- [x] Cancel unpaid pending booking from detail
- [x] Receipt block on booking detail
- [x] Home: next-session hero + quick actions + stats teaser
- [x] Activity tab visible with stats + replays
- [x] Mock stats labeled Preview
- [x] Mock replay library labeled Sample
- [x] Access status and explicit code reveal on booking detail
- [x] Expo push token registration and server-backed preferences
- [x] Account: Notifications, Help, Legal screens
- [x] Cross-links from PRODUCT.md and ux-blueprint.md

---

## Related docs

- [PRODUCT.md](./PRODUCT.md) — product principles
- [design-system/booking-ux.md](./design-system/booking-ux.md) — booking flow
- [design-system/ux-blueprint.md](./design-system/ux-blueprint.md) — funnel overview
- [design-system/coach-and-replays.md](./design-system/coach-and-replays.md) — Coach tab + clip credits
- [../../docs/booking/phase-7-user-complete.md](../../docs/booking/phase-7-user-complete.md) — implementation index
