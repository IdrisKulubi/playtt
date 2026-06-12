# PlayTT UX Blueprint

## Experience Goal
Move the user from curiosity to reservation with minimal ambiguity. Every screen should make the next action obvious and reduce the amount of information the player has to hold in their head.

## Funnel Priority
1. Homepage
2. Auth entry and account creation
3. Dashboard checkpoint
4. Booking flow
5. Auth support screens

## Homepage Blueprint
- First viewport must answer:
  - what PlayTT is
  - why it feels premium
  - how to start
- Primary CTA: `Book now`
- Secondary CTA: `Create account`
- Supporting proof should reinforce the booking flow, not introduce unrelated features

## Auth Journey Blueprint
### Sign up
- Reassure the player that account creation is part of the booking path
- Keep the form narrow and direct
- Offer Google as the fastest option, then email

### Sign in
- Put recovery close to the password field
- Keep the submit action singular and obvious
- Treat two-factor as a continuation of the same flow, not a separate product surface

### Verify email
- Focus on one task: enter the code
- Make resend and restart obvious but secondary

### Password recovery
- Explain the flow in one sentence
- Make the request and confirm screens feel like one secure sequence

## Dashboard Blueprint
- The dashboard is an orientation layer, not a feature dump
- It should confirm account state, reinforce that the product is ready, and lead clearly into booking
- Do not introduce heavy navigation or admin-style density here
- **Home** uses a single-surface hero band: greeting, one headline, and either a primary book CTA (empty) or the next-session ticket embedded inside the hero (upcoming)
- Secondary actions (book another, highlights) use hairline list rows under a "More" label, not bordered cards
- Full stats and replays live on the Activity tab
- See [USER.md](../USER.md) for the complete player IA

## Activity Blueprint
- Compact intro band with Sample badge at screen level (not repeated per segment panel)
- **Clip balance** in intro band: `N clips left` + tappable **Buy clips** (hairline, not a card)
- **Highlights:** featured latest replay (large thumb + play affordance), earlier clips as hairline rows; no glow washes or carousel-in-scroll
- **Stats:** journal-style prose lead (hours on table), month dot rhythm, hairline secondary rows; no hero KPI, bar chart, or bordered chip grid
- Replay detail sheet: title once in sheet header, shared thumb placeholder, one meta line
- Subtle **Reviewed** label on clips analyzed by Coach (subscribers only)

## Coach Blueprint
- Fifth tab (before Account): subscription status, insights, training — see [coach-and-replays.md](./coach-and-replays.md)
- Mirror Activity shell: intro band + segment control (**Insights** | **Training**)
- **Insights:** journal-style prose cards; detail in bottom sheet — never chat-first UI
- **Training:** hairline rows like Home "More" section; drill detail in sheet
- Inactive subscription: single band with `Start Coach` CTA + monthly price line
- Clip packs and Coach bill **independently**; copy must make the split obvious
- Purchase flows reuse booking Paystack pattern (hosted checkout, no urgency timers)

## Account Blueprint
- **Account tab** is the settings hub: profile summary, security actions, sign out
- Use dark product surface to match Home and Bookings; flat layout with section labels and hairline row dividers (no card chrome)
- Identity (name, email, verification) lives in the profile header only; Security is actions-only
- **Stack sub-screens** for edits (personal details, password, email verification) — not additional tabs
- One navigable row per decision area on the hub; forms live on pushed screens with Back + single save CTA
- Home stays booking-focused; account chrome and sign out live on the Account tab only

## Booking Funnel Blueprint

See **[booking-ux.md](./booking-ux.md)** for the canonical mobile booking spec (tap budget, copy, components, anti-patterns).

### When (timing screen)
- Single venue (MVP): skip venue step; show venue as a chip on the timing screen
- Date chips with Today / Tomorrow labels, 30/60 min toggle, available slots with price
- Slot tap is the primary action (no Continue button on this screen)
- Empty day: "No times left" + Try tomorrow

### Players (bottom sheet)
- Opened immediately after slot tap
- Default 2 players; surcharge copy for larger groups
- Continue closes sheet and shows sticky summary bar

### Confirm (bottom sheet + sticky bar)
- Sticky bar shows time, duration, price, and "Book this slot"
- Confirm sheet: summary, collapsible notes, final submit
- Success screen: "You're booked!" with view bookings CTA

## Mobile Behavior
- Target ~3 taps for returning users (slot → players → book)
- One primary action per moment; Back only in screen header
- Sticky checkout bar keeps selection context visible
- Sheets over full-page steps for group size and confirm
- Booking detail from My bookings or Home upcoming card opens in a bottom sheet (drag down or backdrop tap to close), not a pushed screen

## Future Screen Rule
- New screens should be designed by mapping them onto one of the existing shell types first
- If a screen does not fit a shell, update the system intentionally instead of inventing a one-off

## UX Acceptance Standard
- A first-time visitor should understand the product and reach account creation or booking from the homepage in one pass
- A returning player should move from sign-in to booking without a visual or conceptual reset
- A player on mobile should complete location -> timing -> players -> checkout without confusion or missing context
