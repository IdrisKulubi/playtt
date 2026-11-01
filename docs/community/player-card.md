# PlayTT Player Card — Design Spec

The player card is what you see on the Community tab. It should feel like a collectible sports card: bold, tiered and worth showing off. It is **our own design**, inspired by sports trading cards in general, so it does not copy any game's card shapes, names or artwork.

Parent plan: [README.md](./README.md)

## Design goals

1. **Readable in one second.** Name, skill tier, availability and the main number are visible at a glance in a 2-column grid.
2. **Earned, not invented.** Every number on the card comes from real PlayTT data (bookings, scoreboard, kudos). No made-up "attribute ratings".
3. **Collectible.** Tiers, special variants and badges give people a reason to play more and share their card.
4. **On brand.** Uses the existing tokens in `playtt-mobile/constants/playtt-tokens.ts` (cyan `#00b7ff` accent, Space Grotesk) and is dark-first, with a light-mode variant.

## Anatomy (full card, 3:4 ratio)

```
 ┌───────────────────────────────┐
 │ 78        ●  OPEN NOW · →9PM  │  ← rating + status ribbon
 │ CLUB                          │  ← tier name
 │ ATK  R                        │  ← play style + handedness
 │            ┌───────┐          │
 │            │ photo │          │  ← avatar cut-out, tier glow
 │            └───────┘          │
 │ ─────────── AMARA K. ──────── │  ← name plate
 │  42 MAT   61 WIN%   96 REL    │  ← 6 stat slots (2 rows)
 │   7 STK   18 KUD    31 HRS    │
 │ ─────────────────────────────  │
 │ 🏓 Rally ace  🤝 Fair play ⏱  │  ← up to 3 badges
 │ PlayTT · Parklands            │  ← home venue footer
 └───────────────────────────────┘
```

### Top-left block
| Element | Source | Notes |
|---------|--------|-------|
| **Rating** (big number) | Card points (see [Card points and tiers](#card-points-and-tiers)) | 40–99. Shows **NEW** only where card data is not loaded (chat and group lists). |
| **Tier name** | Server tier from card points | **Rookie** (blue) → **Contender** (purple) → **Star** (pink) → **Legend** (gold) |
| **Play style** | `player_profiles.play_style` | `ATK` attacker, `DEF` defender, `ALL` all-round |
| **Handedness** | `player_profiles.handedness` | `R` / `L` |

### Stat slots (6)
All stats are real and computed on the server (`src/server/community/card-stats.ts`).

| Code | Meaning | Source |
|------|---------|--------|
| `MAT` | Matches played | Completed bookings, or confirmed ones that have ended, as owner or session participant (recorded matches join in M5) |
| `WIN` | Win % | Completed 1v1 scoreboard matches with assigned sides; shows `—` until 5 recorded |
| `REL` | Reliability % | Shared community bookings kept vs. late withdrawals and no-shows (README, M4); shows `—` until 3 counted bookings |
| `STK` | Current weekly streak | Consecutive Nairobi weeks with at least one session |
| `KUD` | Kudos received | `community_kudos` count; `—` until the first kudos |
| `HRS` | Hours on the table | Sum of booking durations |

A stat with too little data shows `—` in a muted color, never `0`, so new players don't look bad.

### Status ribbon (top-right)
| State | Look |
|-------|------|
| Open now | Pulsing green dot + `OPEN NOW · →9PM` |
| Open later | Cyan outline + `TONIGHT` / `TODAY` / `WEEKEND` |
| Looking for doubles | Extra `2v2` chip |
| At the venue | Map-pin chip `AT PARKLANDS` with a soft pulse |
| Not open | Ribbon hidden |

## Tiers and variants

Card backgrounds are drawn with `react-native-svg` (`LinearGradient`, `RadialGradient`, `Path`), so no new dependency is needed.

### Card points and tiers

Every number is earned from real PlayTT activity (`src/server/community/card-points.ts`):

| Activity | Points |
|----------|--------|
| Scoreboard win | 25 |
| Session played (`MAT`) | 10 |
| Coach drill completed | 15 |
| Kudos received | 5 |

Rating = `round(40 + 59 × (1 − e^(−points / 1500)))`, capped at 99, so early points move the number quickly and 99 is a long climb. The Elo rating (M5) still drives head-to-head but no longer the card number.

| Tier | Name | From | Base (dark) | Accent | Border |
|------|------|------|-------------|--------|--------|
| **blue** | Rookie | 0 pts | `#0b3a78` → `#061a3a` | `#4fb4ff` | 1.5px |
| **purple** | Contender | 600 pts | `#3d1878` → `#160833` | `#b98cff` | 1.5px |
| **pink** | Star | 1,400 pts | `#7a1650` → `#2e0620` | `#ff7ac8` | 2px |
| **gold** | Legend | 2,500 pts | `#5a4210` → `#1c1404` | `#f5c84c` | 2.5px |

The API returns `stats.points`, `stats.tier` and `stats.nextTierPoints`; the full card shows a "320 pts to Star" progress bar until gold.

Special variants are layered on top of the tier, one at a time, in this priority order:

| Variant | Trigger | Effect |
|---------|---------|--------|
| **In form** | Won 3+ recorded matches in a row | Orange flame edge + `IN FORM` tag |
| **Streak** | Weekly streak ≥ 4 | Animated streak counter on the `STK` slot |
| **Founding player** | Joined during the 90-day pilot | Small "Founding" foil stamp (permanent) |
| **Rally partner** | Mutual follow with the viewer | Linked-paddles icon beside the name |

### Card shape
- A rounded rectangle with a **notched top edge**: a small paddle-shaped dip centered at the top. This is PlayTT's own silhouette, not a crest or shield.
- A diagonal "net line" texture at 6% opacity across the background.
- The player's photo fills the upper card as a portrait that fades into the tier color. Without a photo, a large initials monogram in the tier accent.
- Photos are uploaded from the Create my card screen to R2 (`POST`/`PUT`/`DELETE /api/user/avatar`). `user.image` stores `/api/avatars/{userId}/{file}`, which redirects to a short-lived signed R2 URL, so the bucket stays private. The mini card keeps the round avatar.

## Card sizes

| Size | Used in | Content |
|------|---------|---------|
| **Full** (`PlayerCard size="full"`) | Player profile, own profile, share image | Everything above, and it can flip over |
| **Compact** (`size="compact"`) | Open to Play grid (2 columns), At the venue strip | Rating, tier, avatar, name, status ribbon, 3 stats (`MAT`, `WIN`, `REL`) |
| **Mini** (`size="mini"`) | Followers / Following lists, chat header, Rally Partners row | Avatar with tier ring, name, tier chip, status dot |

## Card back (flip)

Tap the card on the profile screen to flip it (Reanimated `rotateY`, 450 ms).

- Bio (max 140 characters)
- **Usual times** chips (for example, Weekday evenings, Sat mornings)
- **Head-to-head with you**, for example "You 2 – 3 Amara", plus the last match date (M5)
- Kudos breakdown (top 3 kudos types with counts)
- Member since + home venue

## Motion

All motion uses `react-native-reanimated` and is disabled when **Reduce Motion** is on.

| Motion | Where | Spec |
|--------|-------|------|
| Foil shine sweep | Club + Elite full cards | Diagonal highlight, 1.8 s, every 6 s |
| Status pulse | Open now / At venue | Opacity 0.4 ↔ 1, 1.2 s loop |
| Card enter | Open to Play grid | Stagger 40 ms, translateY 12 → 0, fade |
| Press | All sizes | Scale 0.97 + `expo-haptics` light impact |
| Tier up | After a tier change | One-off full-screen reveal with confetti, shown once |

## Sharing

The **Share my card** button on your own profile renders the full card with `react-native-view-shot` (already installed, same approach as `lib/stats-share.ts`). It adds a footer with an invite link (see WhatsApp invites in the README) and opens the share sheet, with WhatsApp first on Android.

## Accessibility

- Each card is one accessible element. Its label reads: "Amara K., Club tier, open now until 9 PM, 42 matches, 61 percent wins".
- Text contrast is at least 4.5:1 on every tier background. Check the Rookie light-mode variant in particular.
- The status is never shown by color alone. It always has a text label.
- Under Reduce Transparency, gradients become solid tier colors.

## Light mode
Same layout. Backgrounds switch to light tier tints (Rookie `#eef3f8`, Club `#e2f4ff`, Elite `#fff7e0`) with dark text, and the foil effects drop to 50% opacity.

## Component plan (`playtt-mobile/components/community/player-card/`)

| File | Role |
|------|------|
| `player-card.tsx` | Public component: `size`, `player`, `onPress`, `flippable` |
| `card-background.tsx` | SVG tier gradient, notch shape, net texture |
| `card-foil.tsx` | Shine sweep and variant overlays |
| `card-stat-grid.tsx` | Stat slots with the `—` empty state |
| `card-status-ribbon.tsx` | Open / later / 2v2 / at-venue ribbon |
| `card-badges.tsx` | Up to 3 badge icons (Phosphor) |
| `card-back.tsx` | Flip side |
| `card-tiers.ts` | Tier and variant tokens (colors, borders), light and dark |
| `player-card.test.tsx` | Rendering for each tier/size, empty stats, accessibility label |

The card must not use `LiquidGlassSurface`, because it is content, not floating chrome. Screens around it (filter segment, floating "Open to play" button) **must** follow `.cursor/skills/liquid-glass-ui/SKILL.md`.
