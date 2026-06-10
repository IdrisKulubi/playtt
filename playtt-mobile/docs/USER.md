# PlayTT User Experience (Mobile)

## Register

product (mobile app, player-facing)

## Audience

End-user **players** only. Admin and ops surfaces live on the web app.

## Completion bar (pre-hardware)

> A player can manage their full PlayTT life in-app — book, pay, review history, see activity, preview entry, and adjust preferences — without hardware integrations.

Hardware (TTLock, lights, real replays) ships after this shell is complete.

---

## Jobs to be done

| Job | Success looks like |
|-----|-------------------|
| Get in and stay signed in | Auth, verify email, profile |
| Book and pay | [booking-ux.md](./design-system/booking-ux.md) |
| Manage upcoming sessions | View, edit, cancel unpaid hold, pay |
| Review past play | Past bookings list, session detail, receipt |
| Understand my activity | Stats dashboard (preview data until API) |
| Know how to enter the pod | Access card on upcoming confirmed booking (preview PIN) |
| Relive sessions | Replay library (sample clips until camera pipeline) |
| Control preferences | Notification prefs stub, help, legal, sign out |

---

## Information architecture

| Tab | Route | Purpose |
|-----|-------|---------|
| **Home** | `(tabs)/index` | Next session hero, quick actions, stats teaser |
| **Bookings** | `(tabs)/bookings` | Upcoming \| Past segments → detail sheet |
| **Activity** | `(tabs)/activity` | Highlights + stats segments |
| **Account** | `(tabs)/account` | Profile, settings stack, support |

Stack screens (pushed from tabs):

| Screen | Route | Data |
|--------|-------|------|
| Book | `(app)/book` | live |
| Activity stats | `(app)/activity/stats` | mock |
| Activity replays | `(app)/activity/replays` | mock |
| Edit profile | `(app)/account/edit-profile` | live |
| Notifications | `(app)/account/notifications` | stub (local) |
| Help | `(app)/account/help` | static |
| Legal | `(app)/account/legal` | static |

---

## Screen inventory

### Live data (P0)

| Surface | Source |
|---------|--------|
| Upcoming bookings | `GET /api/bookings/mine?filter=upcoming` |
| Past bookings | `GET /api/bookings/mine?filter=past` |
| Booking detail | `GET /api/bookings/[id]` |
| Cancel hold | `POST /api/bookings/[id]/cancel` (pending + unpaid only) |
| Edit booking | modifications API |
| Pay hold | payments API |
| Profile | `GET /api/user/me` |

### Preview / mock data (P1)

| Surface | Module | Label in UI |
|---------|--------|-------------|
| Player stats | `lib/mock/mock-player-stats.ts` | "Preview" |
| Replay library | `lib/mock/mock-replays.ts` | "Sample" |
| Entry code | `lib/mock/mock-access.ts` | "Preview entry code" |
| Home stats teaser | mock-player-stats | "Preview" |

### Stub (P2)

| Surface | Storage |
|---------|---------|
| Notification preferences | `lib/notification-prefs.ts` (SecureStore) |
| Help / FAQ | static copy |
| Legal | placeholder links |

---

## Mock data contract

1. All mock surfaces show a visible **Preview** or **Sample** badge — never hidden.
2. Mock modules live under `playtt-mobile/lib/mock/`.
3. `USE_MOCK_PLAYER_DATA` in `mock-config.ts` gates mock stats/replays (default `true`).
4. Preview entry codes are **not** real credentials. Copy: *"Your real code will appear here before your session."*
5. When live APIs ship, swap data layer only; keep UI components.

---

## Copy rules

- Reuse [booking-ux.md](./design-system/booking-ux.md) for booking flows.
- Say **"Your entry code"**, not TTLock PIN or resource name.
- Empty states always include a next action (book, view upcoming, etc.).
- Cancel copy: *"Release this hold"* for unpaid pending bookings.

---

## Out of scope (until hardware phase)

- Real TTLock / Bluetooth unlock
- Lighting automation
- NVR replay upload
- Push notification delivery (prefs UI only)
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
- [x] Access card on confirmed upcoming bookings (preview)
- [x] Account: Notifications, Help, Legal screens
- [x] Cross-links from PRODUCT.md and ux-blueprint.md

---

## Related docs

- [PRODUCT.md](./PRODUCT.md) — product principles
- [design-system/booking-ux.md](./design-system/booking-ux.md) — booking flow
- [design-system/ux-blueprint.md](./design-system/ux-blueprint.md) — funnel overview
- [../../docs/booking/phase-7-user-complete.md](../../docs/booking/phase-7-user-complete.md) — implementation index
