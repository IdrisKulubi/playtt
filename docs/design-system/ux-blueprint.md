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

## Booking Funnel Blueprint
### Step 1: Location
- Start with place selection
- Emphasize venue identity, address, and available tables
- Avoid showing pricing or group complexity too early

### Step 2: Timing
- Show available slots with open-table counts
- Keep date and duration controls nearby
- Make unavailable or past slots easy to distinguish without feeling broken

### Step 3: Group
- Ask for group size only after time is chosen
- Explain the included player count and larger-group surcharge plainly
- Keep the summary of the chosen slot visible

### Step 4: Checkout
- Present venue, time, group, notes, and pricing in a quiet review moment
- The total should be legible immediately
- The reserve action should feel confident and final

## Mobile Behavior
- Prioritize vertical scanning and a single next action
- Keep booking context visible through a compact summary bar or stacked summary card
- Avoid making the player jump between hidden panels to understand price or selection state

## Future Screen Rule
- New screens should be designed by mapping them onto one of the existing shell types first
- If a screen does not fit a shell, update the system intentionally instead of inventing a one-off

## UX Acceptance Standard
- A first-time visitor should understand the product and reach account creation or booking from the homepage in one pass
- A returning player should move from sign-in to booking without a visual or conceptual reset
- A player on mobile should complete location -> timing -> players -> checkout without confusion or missing context
