---
name: PlayTT
description: Premium,  table tennis booking
colors:
  primary: "#00b7ff"
  primary-foreground: "#041019"
  primary-glow: "rgba(0, 183, 255, 0.26)"
  background: "#07111d"
  background-elevated: "#0b1627"
  card: "#101b2b"
  border: "#203149"
  input: "#162336"
  muted-text: "#92a6bf"
  foreground: "#ffffff"
  destructive: "#ff3b30"
  success: "#00ff66"
  warning: "#ffb800"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "1rem"
    fontWeight: 450
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  field: "1.25rem"
  card: "1.75rem"
  panel: "2rem"
  pill: "9999px"
spacing:
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.875rem 1.125rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.875rem 1.125rem"
  card-premium:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "1.25rem"
  input-field:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "0.875rem 1rem"
---

# Design System: PlayTT

## 1. Overview

**Creative North Star: "Calm Electric Precision"**

PlayTT is premium and private, designed for on-the-go mobile booking where trust must arrive fast and the next action must be obvious. The system uses **two surfaces**: dark ink for marketing (`MarketingShell` with `.dark`), and a light product layer for booking, dashboard, and auth forms. Electric azure is a disciplined signal for focus, CTA, and state on both surfaces.

This system explicitly rejects SaaS landing-page clichés, gamified sports UI noise, AI-dashboard glass overload, and budget booking clutter. It should feel intentional and steady, not flashy, not empty.

**Key Characteristics:**
- Quiet, structured hierarchy that makes the next step unmissable
- Electric azure as a rare but decisive signal, never wallpaper
- Rounded, confident geometry with soft layering and restrained glow
- Copy and controls designed for one-thumb use on mobile

## 2. Colors

### Product (light, default `:root`)

Near-white backgrounds with ink-tinted text (OKLCH), soft borders, and azure for actions only. Booking uses flat lists, segmented duration controls, and an ink sticky checkout bar.

### Marketing (dark, `.dark` wrapper)

Ink-dark and high-contrast, with the same electric accent. Hero and home live here.

### Primary
- **Electric Azure** (`#00b7ff`): Primary CTA, focus rings, active states, and the few moments where the interface needs to guide attention with certainty.
- **Ink-on-Azure** (`#041019`): Text/icon color when sitting on the primary surface.

### Neutral
- **Deep Ink Background** (`#07111d`): Page background and shell base.
- **Elevated Ink** (`#0b1627`): Panels, shell sections, and surface separation without borders first.
- **Premium Card Surface** (`#101b2b`): Primary content containers.
- **Stroke Border** (`#203149`): Borders and dividers, used to clarify structure, not to decorate.
- **Field Surface** (`#162336`): Input backgrounds and interactive surfaces that must read as tappable.
- **Muted Text** (`#92a6bf`): Secondary copy only. Never for primary labels or critical data.
- **Foreground** (`#ffffff`): Primary text and icons on dark surfaces.

### Named Rules (optional, powerful)
**The Azure Is a Verb Rule.** Azure indicates an action, a focus, or a state change. If azure is present but nothing changed, it's misuse.

## 3. Typography

**Display/Body Font:** Space Grotesk (with system fallbacks)  
**Mono/Numeric Utility Font:** Geist Mono (used when alignment and numeric stability matter)

**Character:** A modern, confident sans with enough personality to feel premium, but clean enough to stay calm under dense booking decisions.

### Hierarchy
- **Display** (650, clamp, 1.05): Hero headlines and high-level page titles only.
- **Headline** (600, clamp, 1.15): Section headers that anchor a stage of the booking flow.
- **Title** (600, 1.125rem, 1.25): Card titles and compact headings.
- **Body** (450, 1rem, 1.65): Explanations and guidance, keep line length tight and avoid dense paragraphs.
- **Label** (600, 0.875rem, 0.01em): Buttons, field labels, and navigational controls.

### Named Rules (optional)
**The One-Viewport Rule.** First-time understanding must happen within one viewport, typography and spacing must serve comprehension before decoration.

## 4. Elevation

Depth is conveyed primarily through **tonal layering** (background → elevated → card → input) with occasional soft shadow to separate panels. Shadows should feel ambient and premium, never sharp or “card stack” heavy.

### Shadow Vocabulary (if applicable)
- **Soft** (`0 18px 48px rgba(0, 0, 0, 0.22)`): Gentle lift for panels that need separation from the base.
- **Panel** (`0 28px 90px rgba(0, 0, 0, 0.32)`): Auth/product shells and major stage containers.
- **Strong** (`0 34px 120px rgba(0, 0, 0, 0.45)`): Rare, used only for high-emphasis surfaces.

### Named Rules (optional)
**The Layer-First Rule.** If elevation can be communicated by tonal layering, do that. Shadows are for separation, not styling.

## 5. Components

### Buttons
- **Character:** Tactile, calm confidence. One dominant action per view.
- **Shape:** Pill geometry (9999px) with generous padding for mobile.
- **Primary:** Electric Azure background with ink foreground. Reserved for the single dominant next action.
- **Hover / Focus:** Focus uses the primary ring. Hover is subtle, never bouncy.
- **Ghost:** Quiet navigation and utility actions. Never competes with primary.

### Cards / Containers
- **Character:** Premium surfaces with confident rounding and clear internal rhythm.
- **Corner Style:** Card radius (1.75rem).
- **Background:** Premium card surface (`#101b2b`) on ink backgrounds.
- **Border:** Use the stroke border sparingly when structure needs clarification.
- **Internal Padding:** Start at spacing xl (2rem) for major containers, md-lg inside cards.

### Inputs / Fields
- **Character:** Clearly interactive, calm, and readable on dark surfaces.
- **Style:** Field surface background (`#162336`), field radius (1.25rem).
- **Focus:** Primary ring and/or subtle glow. Always visible.
- **Error:** Destructive color is for errors only, paired with direct copy.

### Navigation
- **Character:** Quiet, reliable, and readable at a glance.
- **States:** Active state may use azure, but never as a persistent decorative strip.

## 6. Do's and Don'ts

### Do:
- **Do** keep electric azure meaningful, use it for CTA/focus/active state only.
- **Do** preserve booking clarity by keeping one dominant primary action per view.
- **Do** use tonal layering (background → elevated → card → input) before adding borders.
- **Do** keep labels literal and action-first, optimized for mobile scanning.

### Don't:
- **Don't** build SaaS landing-page clichés (hero metric blocks, repeated feature-card grids, social proof walls).
- **Don't** introduce gamified sports UI noise (badges, streaks, neon celebration energy).
- **Don't** use AI-dashboard glass overload (decorative blur panels everywhere, gradient blobs, chat-first chrome).
- **Don't** drift into budget booking clutter (dense filters, tiny type, anxious urgency timers).
- **Don't** rely on muted text (`#92a6bf`) for critical labels or decisions.
