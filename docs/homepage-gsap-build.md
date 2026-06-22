# Homepage GSAP Build Guide

Step-by-step playbook for transforming the PlayTT marketing homepage (`/`) from a generic landing page into a cinematic, premium first impression using GSAP. Build **one phase at a time**, review in the browser, then move on.

**Inspiration (translated, not copied):** [Axis AI CRM Web (Emote Agency)](https://dribbble.com/shots/27429331-Axis-AI-CRM-Web) — layered hero, product-in-context preview, asymmetric composition.

**Related docs:** [`docs/PRODUCT.md`](PRODUCT.md) · [`docs/DESIGN.md`](DESIGN.md) · [`docs/design-system/ux-blueprint.md`](design-system/ux-blueprint.md)

---

## Creative north star

**"The pod portal opens."**

The first second should feel like the user is looking into a private PlayTT pod coming online: an ink-dark chamber, a table-tennis table drawn in precise SVG lines, one controlled azure portal glow, and the booking phone acting like the control surface. Motion is **confident and sparse**, not decorative noise.

**Decisions locked for this build:**

| Decision | Choice |
|----------|--------|
| First section to ship | Hero |
| Motion intensity | Cinematic but calm (bold entrance, restrained scroll) |
| Hero concept | Pod Portal |
| Implementation depth | GSAP + custom SVG scene, no WebGL |
| Build cadence | One phase per pass; pause for visual review after Phase 1 |
| Route scope | Homepage only (`/`); booking/dashboard stay static |

---

## Brand guardrails (do not break)

- No hero KPI blocks, social proof walls, or identical feature-card grids
- No purple AI gradients, chat-first chrome, or decorative glass everywhere
- Electric azure (`#00b7ff`) only for actions, focus, and rare emphasis
- No bounce/elastic easing; use `power3.out` and calm durations
- Honor `prefers-reduced-motion`: final state visible immediately, no auto-cycling phone screens
- Copy stays literal and calm; no em dashes in new copy

---

## Known issues to fix

| Issue | Cause | Fixed in |
|-------|-------|----------|
| "How it works" heading hard to read (light band on page) | `MarketingShell` uses `.dark` text tokens but `main` has no ink background; body stays light | Phase 0 |
| Homepage feels generic | Predictable layout, CSS-only phone fade, cluttered above-fold CTAs | Phase 1 Pod Portal |
| Weak product proof | Small phone mock with opacity crossfade and no physical pod atmosphere | Phase 1 Pod Portal |

---

## Build order overview

```
Phase 0  Foundation (GSAP setup + ink canvas)     ─┐
Phase 1  Hero (awe on first load)                 ├─ Ship together first
                                                  ─┘
Phase 2  Header shell
Phase 3  How it works
Phase 4  Locations
Phase 5  Get started band
Phase 6  Footer + final QA
```

**Rule:** Do not start the next phase until the current one passes its acceptance checklist.

---

## Architecture pattern

Every animated section follows the same split:

1. **Server component** (`*-section.tsx`) — semantic HTML, data fetching, SEO-friendly copy
2. **Client motion wrapper** (`*-motion.tsx` or `*-section-motion.tsx`) — GSAP via `useGSAP` from `@gsap/react`
3. **Shared utilities** — easing, durations, reduced-motion gate

```
src/app/page.tsx (server, async)
└── MarketingShell
    ├── HeroSection → HeroSectionMotion (client)
    ├── HowItWorksSection → HowItWorksMotion (client)
    ├── LocationsSection → LocationsMotion (client)
    ├── PartnerSection → GetStartedMotion (client)
    └── SiteFooter → SiteFooterMotion (client, light)
```

GSAP must **not** load on `/book`, `/dashboard`, or auth routes.

---

## Phase 0: Foundation

**Bundle with Phase 1** — contrast fix blocks hero review.

### Checklist

- [ ] Install dependencies: `pnpm add gsap @gsap/react`
- [ ] Create `src/lib/gsap/register-gsap.ts` — register `ScrollTrigger` once (client-only)
- [ ] Create `src/hooks/use-prefers-reduced-motion.ts`
- [ ] Create `src/components/home/motion/marketing-motion.ts` — shared `power3.out`, durations, stagger constants
- [ ] Fix `src/components/layout/marketing-shell.tsx`:

```tsx
<main className="dark relative min-h-screen bg-background text-foreground">
```

### Motion wrapper rules

- Use `useGSAP` with `scope` ref on section root
- Always `return () => ctx.revert()` on cleanup
- Kill ScrollTriggers when component unmounts
- Gate all loops and auto-play on `!prefersReducedMotion`

---

## Phase 1: Hero (first ship) — Pod Portal

**Goal:** User opens `/` and within ~1.2s feels the product is real, premium, and alive.

**Concept:** The hero is no longer a phone mock beside copy. It becomes a cinematic portal into a private table-tennis pod. The phone is still present, but it is secondary: the product proof is the relationship between the real pod scene and the booking control surface.

### Files to create or edit

| File | Action |
|------|--------|
| `src/components/home/hero-section.tsx` | Layout: full viewport stage, asymmetric grid |
| `src/components/home/hero-section-motion.tsx` | **New** — GSAP load timeline |
| `src/components/home/hero-pod-portal-scene.tsx` | **New** — custom SVG pod/table portal scene |
| `src/components/home/hero-phone-screens.tsx` | Shared phone screen markup |
| `src/components/home/hero-phone-animation.tsx` | **New** — GSAP screen timeline + float |
| `src/app/globals.css` | `.hero-stage`, `.hero-portal-*`, `.hero-line`, phone placement |

### Layout requirements

- [ ] Full viewport stage: `min-h-[calc(100svh-5rem)]`
- [ ] Asymmetric split: copy left ~42%, portal scene right ~58%
- [ ] SVG pod scene is the visual anchor: table outline, back wall, entry glow, small ball path
- [ ] Phone sits partially in front of the portal as the booking control surface, not the whole hero
- [ ] Phone width ~240–280px on desktop; portal scene gets the larger visual footprint
- [ ] Trust strip fades in last or sits below fold (not competing with CTAs)
- [ ] Featured venue ticket becomes a small floating “next booking” chip inside the portal area
- [ ] Remove decorative grid texture entirely; single purposeful portal glow only

### Pod Portal SVG scene

Build `hero-pod-portal-scene.tsx` as inline SVG so GSAP can target individual parts:

| SVG part | Purpose | Motion |
|----------|---------|--------|
| `data-portal-ring` | Pod entrance / portal ellipse | stroke draw + glow pulse |
| `data-table-surface` | Table-tennis table plane | line draw from center outward |
| `data-table-net` | Net line | quick draw after table appears |
| `data-pod-wall` | Back-wall perspective lines | low-opacity fade in |
| `data-ball-path` | Single serve trajectory | path draw, no looping during reduced motion |
| `data-ball` | Ball dot | moves once along path, then settles |

Keep the scene abstract and premium. It should suggest a private pod, not become a literal cartoon illustration.

### GSAP load timeline (~1.1s total, `power3.out`)

| Step | Element | Animation |
|------|---------|-------------|
| 1 | Portal glow | scale 0.75→1, opacity 0→0.36 |
| 2 | Portal ring | SVG stroke draw, 0→100% |
| 3 | Table surface + net | SVG line draw from center outward |
| 4 | Ball path + ball | path draw + ball travels once through the portal |
| 5 | Eyebrow label | y 12→0, opacity 0→1 |
| 6 | Headline lines | wrap each line in `.hero-line`, stagger 0.08s |
| 7 | Subcopy + tagline | fade up, short travel |
| 8 | CTAs | primary first, outline +0.1s |
| 9 | Phone frame | y 36→0, scale 0.94→1, rotateX 4→0; optional float loop y ±5 over 4s |
| 10 | Phone screens | GSAP timeline: venues → timing → checkout (4s hold each) |
| 11 | Venue ticket chip | slide up + fade, +0.25s after phone |
| 12 | Trust strip | opacity 0→1, last |

### Do not

- Bounce or elastic easing
- Particle effects or full-page parallax
- Literal neon sci-fi tunnel clutter
- Over-detailed sports illustration
- Gradient text on headline
- Hero metrics or fake social proof

### Acceptance checklist

- [ ] Headline + "Book now" visible without scroll on mobile (375px)
- [ ] Load animation completes in under 1.5s
- [ ] Portal scene reads as a private table-tennis pod within 2 seconds
- [ ] `prefers-reduced-motion`: all elements visible, no screen loop
- [ ] Phone uses real featured venue name when DB has locations
- [ ] `npx impeccable --json src/components/home` returns zero findings
- [ ] **Pause here for visual review before Phase 2**

---

## Phase 2: Header shell

**Goal:** Header feels integrated with the hero, not a floating generic pill.

### Files

- `src/components/layout/marketing-shell.tsx`
- `src/components/layout/marketing-header-motion.tsx` (**new**)

### Checklist

- [ ] Header enters: y -16→0, opacity 0→1, starts ~0.2s after hero headline
- [ ] Scroll past hero: subtle shrink (padding or scale 1→0.98), ScrollTrigger scrub, light range
- [ ] Desktop nav links: stagger fade-in on load
- [ ] Consider removing `glass-panel-strong` double chrome; single elevated shell + hairline border

### Acceptance

- [ ] Header readable and sticky on scroll
- [ ] Shrink motion is subtle (user notices polish, not animation)

---

## Phase 3: How it works

**Goal:** Step rail animates in with scroll; section visually distinct from hero.

### Files

- `src/components/home/how-it-works-section.tsx`
- `src/components/home/how-it-works-motion.tsx` (**new**)

### Checklist

- [ ] Keep horizontal step rail layout (no card grid)
- [ ] Add vertical azure progress line that draws on scroll (SVG or pseudo-element height scrub)
- [ ] Section header fades up at ~20% viewport entry
- [ ] Each step: number circle scales in, copy slides from right, stagger 0.12s
- [ ] Optional: pin left column on desktop only (`lg+`); skip pin on mobile

### Acceptance

- [ ] All step text readable on ink background
- [ ] Progress line syncs with scroll position
- [ ] No pin jank on mobile

---

## Phase 4: Locations

**Goal:** Featured venue feels important; list rows reveal with calm stagger.

### Files

- `src/components/home/locations-section.tsx`
- `src/components/home/locations-motion.tsx` (**new**)

### Checklist

- [ ] Increase featured strip visual weight (more padding, clearer hierarchy)
- [ ] Featured strip: horizontal clip-path reveal + content fade
- [ ] List rows: stagger y 20→0 via ScrollTrigger batch
- [ ] Initials marks: subtle scale 0.95→1 per row
- [ ] Data remains server-driven from `getBookingBootstrapData()`

### Acceptance

- [ ] Featured venue links to `/book?venue={slug}`
- [ ] Empty state still works when no locations
- [ ] Stagger does not block interaction after animation

---

## Phase 5: Get started band

**Goal:** Single azure moment that drives signup without repeating hero CTA copy.

### Files

- `src/components/home/partner-section.tsx`
- `src/components/home/get-started-motion.tsx` (**new**)

### Checklist

- [ ] Azure band wipe: background width 0→100% on scroll enter
- [ ] Copy fades in after wipe
- [ ] CTA copy: "Sign up free" (not "Create account" again)
- [ ] Section id stays `#get-started`; nav label "Get started"

### Acceptance

- [ ] Text contrast on azure band meets WCAG AA
- [ ] Motion feels like one confident band, not a second hero

---

## Phase 6: Footer + final polish

**Goal:** Clean landing; performance and a11y verified.

### Files

- `src/components/home/site-footer.tsx`
- `src/components/home/site-footer-motion.tsx` (**new**, light fade only)

### Checklist

- [ ] Footer fades in on scroll enter
- [ ] Hide or fix `#` placeholder links (Company, Legal, Connect) if still placeholders
- [ ] Run `pnpm lint` and `pnpm exec tsc --noEmit`
- [ ] Run `npx impeccable --json src/components/home`
- [ ] Test viewports: 375px, 768px, 1280px
- [ ] Keyboard: all CTAs reachable during and after animations
- [ ] Confirm GSAP bundle does not bloat booking/auth routes (dynamic import in motion wrappers)

---

## What we are NOT building

- Full-page pinned scroll timeline (SaaS demo trope)
- Cursor followers or magnetic buttons on every element
- WebGL / Three.js hero
- Font change away from Space Grotesk
- Hero stats ("10,000+ sessions")
- CRM-style dashboard preview in hero (booking flow only)

---

## Commands reference

```bash
# Dev server
pnpm dev

# After each phase
pnpm lint
pnpm exec tsc --noEmit
npx impeccable --json src/components/home src/app/page.tsx

# Install GSAP (Phase 0)
pnpm add gsap @gsap/react
```

---

## Progress tracker

| Phase | Status | Shipped | Notes |
|-------|--------|---------|-------|
| 0 Foundation | ✅ | Phase 0 | GSAP installed, hooks + register, ink background |
| 1 Hero | ✅ | Phase 1 | **Review in browser before Phase 2** |
| 2 Header | ⬜ | | |
| 3 How it works | ⬜ | | |
| 4 Locations | ⬜ | | |
| 5 Get started | ⬜ | | |
| 6 Footer + QA | ⬜ | | |

---

## Next step

Start **Phase 0 + Phase 1** when ready to implement. After Phase 1 ships, review the hero in browser at mobile and desktop widths before continuing to Phase 2.
