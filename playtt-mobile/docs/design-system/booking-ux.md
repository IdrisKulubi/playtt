# Mobile Booking UX

Canonical guide for PlayTT mobile booking decisions. When changing the booking flow, read this first.

## Goal

A returning player should book in **about 3 taps**:

1. Open booking
2. Tap a time slot
3. Confirm players and book

First-time users get the same path with light guidance (progress dots, plain copy).

## Flow

```mermaid
flowchart LR
  home[Home: Book a session] --> timing[When screen]
  timing --> slotTap[Tap slot]
  slotTap --> groupSheet[Group size sheet]
  groupSheet --> stickyBar[Sticky summary bar]
  stickyBar --> confirmSheet[Confirm sheet]
  confirmSheet --> pay[Pay with M-Pesa]
  pay --> done[Confirmed]
```

## Tap budget

| User | Target taps after opening Book |
|------|-------------------------------|
| Returning, single venue | 3 (slot → continue players → book) |
| First-time | 3–4 (same, may read progress dots) |
| Multi-venue (future) | +1 only if user changes venue |

## Defaults

| Choice | Default | When user chooses |
|--------|---------|-------------------|
| Venue | Only location (Hurlingham) | Multi-venue: venue chip → picker sheet |
| Date | Today | Date chips (Today, Tomorrow, weekday) |
| Duration | 60 min | 30 / 60 toggle |
| Players | 2 | Group size sheet after slot tap |
| Notes | Hidden | "Add a note (optional)" on confirm sheet |

## Component map

| File | Responsibility |
|------|----------------|
| `components/booking/booking-flow.tsx` | State, API calls, step routing |
| `components/booking/timing-panel.tsx` | Pinned filters + scrollable slot list, empty state |
| `components/booking/group-size-sheet.tsx` | Player count after slot selection |
| `components/booking/booking-checkout-bar.tsx` | Sticky summary + "Book this slot" |
| `components/booking/booking-confirm-sheet.tsx` | Final review, notes, submit |
| `components/booking/booking-payment-step.tsx` | Pay step (hosted checkout) after hold created |
| `components/booking/booking-detail-payment-actions.tsx` | Pay now CTA on booking detail |
| `components/booking/booking-progress.tsx` | When → Players → Done dots |
| `components/ui/bottom-sheet.tsx` | Shared sheet primitive |

## Theming

Booking uses `useProductTheme()` from [`hooks/use-product-theme.ts`](../../hooks/use-product-theme.ts). It follows the device color scheme:

| Mode | Surfaces |
|------|----------|
| Light | `productBackground`, white cards, dark text |
| Dark | App dark tokens (`background`, `card`, `foreground`) |

Do not hardcode `PlayTTColors.product*` in booking components. Pass `productTheme` to `Button` when `surface="product"`.

## Decision rules

### Sheets vs full screens

- **Use bottom sheets** for group size and final confirm. They keep context visible and reduce steps.
- **Use full screens** only for the main timing list and confirmation success.
- **Never** use a full-page checkout step when a sheet can hold the summary.

### When to skip steps

- **Single venue:** auto-select and skip venue step. Show venue as a chip on the timing screen.
- **Multi-venue (future):** venue chip opens a picker sheet; do not add a dedicated wizard step unless there are 3+ venues.

### Timing layout

- Pin venue chip, date strip, and duration toggle at the top.
- Only the **Available times** list scrolls (`flex: 1` slot `ScrollView`).
- Do not wrap the whole timing screen in an outer scroll view.

### One primary action per moment

- Timing screen: pick a slot (no Continue button).
- Group sheet: Continue.
- Sticky bar: Book this slot.
- Confirm sheet: Book this slot (submit).

Back navigation lives in the screen header only. Do not pair Back + Continue on the same row.

## Copy standards

| Context | Copy |
|---------|------|
| Timing headline | When do you want to play? |
| Group sheet title | How many of you? |
| Sticky bar CTA | Book this slot |
| Confirm CTA | Book this slot |
| Pay step headline | Complete payment |
| Pay CTA | Pay now |
| Pay waiting | Finish payment in the secure checkout page |
| Pending status | Complete payment to confirm your booking. |
| Success title | You're booked! |
| Empty slots | No times left for this day. |
| Empty action | Try tomorrow |

Tone: concise, human, action-first. No internal terms (resource, pod ID, table count).

## Empty and error patterns

- **No slots:** message + "Try tomorrow" (advances date by one day).
- **Slot taken (409):** toast, clear selection, refresh availability.
- **Network/API:** `toast.apiError()` with friendly fallback copy.
- **Loading:** skeleton presets from `@/components/ui/skeleton`, not spinners.

## Anti-patterns

Do not reintroduce:

- Group size chips on the timing screen before a slot is chosen
- A venue step when only one venue exists
- Dual Back + Continue rows on booking steps
- Large notes field on the main timing screen
- System jargon ("1 table", "resource") in player-facing copy

## Future: multi-venue

When a second location ships:

1. Keep timing as the default screen.
2. Venue chip becomes tappable → bottom sheet list.
3. Changing venue clears slot, quote, and group confirmation.
4. Do not restore a full-page venue wizard unless UX testing shows confusion.

## Edit booking flow

Edits launch from the **booking detail sheet**, not a separate full-page form. Use stacked bottom sheets like the book flow.

```mermaid
flowchart LR
  detail[Detail sheet] --> intent[What to change]
  intent --> timeSheet[Change time sheet]
  intent --> playerSheet[Add players sheet]
  timeSheet --> review[Review before/after]
  playerSheet --> review
  review --> pay[Pay delta if needed]
```

### Edit tap budget

| Change | Target taps after Edit |
|--------|------------------------|
| Add players only | 3 (intent → players → confirm) |
| Change time only | 3 (intent → time → confirm) |
| Both | 4 (intent → time → players → confirm) |

### Edit component map

| File | Responsibility |
|------|----------------|
| `components/booking/booking-edit-flow.tsx` | Sheet orchestration, quote, apply |
| `components/booking/booking-edit-intent-sheet.tsx` | What to change (time / players) |
| `components/booking/booking-edit-time-sheet.tsx` | Reuses `timing-panel` (compact, no duration toggle) |
| `components/booking/booking-edit-review-sheet.tsx` | Current vs updated summary + CTA |
| `hooks/use-modification-checkout.ts` | Payment poll + confirming state |

### Edit copy standards

| Context | Copy |
|---------|------|
| Intent sheet title | Edit booking |
| Intent prompt | What do you want to change? |
| Time sheet title | Change time |
| Time headline | Pick a new time |
| Players sheet title | Add players |
| Review title | Review changes |
| Quoting | Calculating new total… |
| Confirming payment | Confirming your update… |
| Venue on review | Same venue (not resource/table name) |
| Cheaper slot | New total … (… less, no refund). |
| Blocked edit | Edits close 2 hours before start |

### Edit rules

- Date strip is **anchored on the booking day**, not always Today.
- On date change, clear slot selection until availability loads; auto-select first valid slot.
- Reuse `TimingPanel` and `GroupSizeSheet`; do not duplicate chip/slot UI.
- Review always shows **Current** and **Updated** rows before confirm.
- Loading uses skeletons; empty slots use in-list "Try tomorrow" only.

## Related docs

- [ux-blueprint.md](./ux-blueprint.md) — funnel overview
- [../PRODUCT.md](../PRODUCT.md) — product principles
- [../../docs/booking/phase-2-mobile-ui.md](../../docs/booking/phase-2-mobile-ui.md) — implementation reference
