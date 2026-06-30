---
target: web homepage
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-06-30T18-09-27Z
slug: src-app-page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Hero implies live availability but does not expose actual slot status or loading/failure state. |
| 2 | Match System / Real World | 3 | Copy is mostly clear, but "pod" needs earlier physical clarity for first-timers. |
| 3 | User Control and Freedom | 3 | Main exits and links exist, but anchor navigation does not communicate scroll position. |
| 4 | Consistency and Standards | 2 | Homepage campaign styling conflicts with premium calm product surfaces and CTA vocabulary varies. |
| 5 | Error Prevention | 2 | Pricing, availability, and account requirements are deferred until after the CTA. |
| 6 | Recognition Rather Than Recall | 3 | Main actions are visible, but multiple CTAs force users to decide between booking and account creation. |
| 7 | Flexibility and Efficiency of Use | 2 | Returning users can book quickly, but no fast repeat-booking or recent venue affordance exists on the homepage. |
| 8 | Aesthetic and Minimalist Design | 2 | Strong visual craft, but ticker, oversized type, drop shadows, and multiple CTA layers compete. |
| 9 | Error Recovery | 2 | The no-location state exists but is visually weak and does not give a useful next step beyond checking back. |
| 10 | Help and Documentation | 1 | No visible FAQ/support/what-is-a-pod path for cautious first-time visitors. |
| **Total** | | **22/40** | **Acceptable, but the first viewport needs strategic tightening.** |

#### Anti-Patterns Verdict

LLM assessment: The page does not look generic, which is good. The risk is the opposite: it now feels like a loud campaign page rather than premium consumer calm. The azure hero, cream/coral/lime accents, square buttons, ticker, giant type, phone render, and trust chips create a lot of simultaneous brand signals. It is memorable, but it strains the documented Oura or Apple Fitness style target.

Deterministic scan: unavailable. The detector command returned `Error: bundled detector not found.` Browser overlay was not available because browser automation tools were not exposed in this session.

#### Overall Impression

The homepage has craft and energy, but the primary journey is not as clear as it should be. A first-time player should instantly understand: private table tennis, pick a venue/time, pay, play. Instead they get a strong vibe, several CTAs, a repeated ticker, and an app screenshot before enough physical context.

#### What's Working

1. The first fold has a bold point of view. It is not a sleepy SaaS layout and it uses real product imagery instead of empty cards.
2. The locations section is the strongest conversion section because it connects the abstract brand promise to actual bookable venues.
3. Motion has reduced-motion guards in the GSAP components, which is the right foundation for an expressive marketing page.

#### Priority Issues

**[P1] CTA competition weakens the booking path**
Why it matters: The page asks users to choose among Book now, Book your rally, Create account, Sign in, Sign up free, and section anchors. For a booking product, that is too many adjacent decisions before the user has committed.
Fix: Make `/book` the only dominant action above the fold. Move account creation to supporting copy or after the booking CTA. Use one label, probably "Book a session" or "Book your table", everywhere.
Suggested command: `$impeccable distill homepage CTAs`

**[P1] Visual tone is more loud campaign than premium calm**
Why it matters: The documented brand target is premium, private, and calm. The current square shadow buttons, ticker, coral/lime accents, and huge compressed headline feel closer to street-poster energy. That can be cool, but it may reduce trust for payment and reservation.
Fix: Keep the azure brand commit, but reduce secondary colors and remove the ticker or make it quieter. Return buttons to the product pill language or make the square language a deliberate one-off only in the hero.
Suggested command: `$impeccable quieter homepage`

**[P1] The physical offer is not concrete enough in the first viewport**
Why it matters: First-time visitors need to understand what they are booking. The hero shows a mobile booking screen, but not enough of the actual table, room, pod, venue, or access experience.
Fix: Add one decisive real venue/table image or immersive visual in the hero. Pair "Private pods" with a short literal explanation: private table tennis room for your group.
Suggested command: `$impeccable clarify homepage hero`

**[P2] Scroll sections are visually ambitious but cognitively heavy**
Why it matters: The how-it-works section uses a rail, moving ball, angled phones, large typography, and separate links per step. It is engaging, but it asks the user to parse the choreography instead of simply moving toward booking.
Fix: Keep the three-step story, but make each step read as a direct booking decision: choose pod, pick time, pay and play. Use one CTA at the end of the sequence, not one per step.
Suggested command: `$impeccable layout homepage journey`

**[P2] Empty and edge states undercut trust**
Why it matters: If there are no locations, the empty state appears inside the cream locations section with styling that was designed for a dark surface. That is the exact moment trust is fragile.
Fix: Restyle the no-location state for the cream section, add a contact/waitlist action, and do not route users to `/book` if there is nothing bookable.
Suggested command: `$impeccable harden homepage states`

#### Persona Red Flags

**Jordan, first-time visitor**: Jordan understands "book" quickly, but may not understand "pod" literally. The first fold says private pods and shows a phone, not the physical experience. They may wonder whether this is a venue, an app, a club, or a membership.

**Casey, distracted mobile user**: Casey gets a lot at once: top nav, menu, book button, huge headline, two hero CTAs, trust chips, and animated ticker. The action is visible, but the visual motion and competing actions increase thumb-and-attention load.

**Riley, stress tester**: Riley will notice the homepage depends on live `getBookingBootstrapData()`. If locations are empty, the page has an empty state, but the navigation and hero still push booking. That mismatch can create a dead-end feeling.

#### Minor Observations

- The top nav repeats account creation in both nav and hero, which makes sign-up feel as important as booking.
- The words "rally", "pod", "table", and "session" all appear as core nouns. Pick a stable hierarchy.
- The locations map is memorable, but the real address list probably does more conversion work than the stylized map.
- The motion system is sophisticated, but the homepage should still be compelling if motion is reduced or JS is slow.

#### Questions to Consider

- Should PlayTT feel more "premium private club" or more "energetic social night out" on the first viewport?
- What would we remove if the only success metric were bookings started from the homepage?
- Does the first-time visitor need to see the app first, or the real room first?
