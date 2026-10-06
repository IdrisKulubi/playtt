---
name: liquid-glass-ui
description: PlayTT mobile liquid glass (WhatsApp-style) UI — surfaces, segments, tab bar, and panels. Read before any playtt-mobile chrome or floating control change.
---

# Liquid glass UI (mobile)

Use this system for floating bars, segment controls, and glass panels in `playtt-mobile/`. Do not introduce new product chrome with `LiquidGlassFallback` or flat cyan segment pills.

## When to read

- New or changed bottom tab bar, segment toggles, floating pills, or section cards on scrollable screens
- Any task that mentions glass, blur, or WhatsApp-style navigation chrome

## Building blocks

| Piece | Path | Role |
|-------|------|------|
| Glass background | `components/ui/liquid-glass-surface.tsx` — `LiquidGlassSurface`, `useNativeLiquidGlass()`, `liquidGlassFill` | iOS 26+ `GlassView`, else chrome material blur / Android overlay |
| Chrome tokens | `components/ui/liquid-glass-chrome.ts` | Monochrome label colors + selection chip rgba + pill border |
| Segments | `components/ui/glass-segment-control.tsx` | Highlights/Stats, Bookings, Coach sub-tabs |
| Tab bar | `components/navigation/glass-tab-bar.tsx` | Bottom tabs |
| Content cards | `components/ui/glass-panel.tsx` | Stats blocks, replay rows |

Tab bar re-exports: `components/navigation/tab-bar-glass-surface.tsx` (thin wrapper; prefer `LiquidGlassSurface` for new code).

## Visual rules

1. **Selection** — rounded chip behind the active item (icon+label or label only), not a cyan tint or icon-only circle.
2. **Labels** — `liquidGlassLabelColor(colorScheme, active)` for active/inactive neutrals.
3. **Borders** — `liquidGlassPillBorderColor`; skip heavy drop shadow when `useNativeLiquidGlass()` is true.
4. **Brand cyan** — CTAs and data accents only; not for tab/segment selected state.

## Accessibility

`LiquidGlassSurface` listens for iOS Reduce Transparency and renders a solid elevated fill. Do not bypass this with raw `BlurView` on new product surfaces.

## Auth exception

`components/auth/auth-glass.tsx` uses `BlurTargetView` and gradients for the auth story. Do not replace auth glass with `LiquidGlassSurface` unless explicitly redesigning auth.

## Legacy

`components/ui/liquid-glass-fallback.tsx` remains for older call sites only; migrate to `LiquidGlassSurface` when touching those files.

## After changes

```bash
cd playtt-mobile
npm run lint
```

Manual check: scroll content behind a floating glass control; confirm blur/glass and chip selection on device (iOS Expo Go or dev build).
