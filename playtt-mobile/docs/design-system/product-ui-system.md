# PlayTT Product UI System

## Canonical Sources
- Tokens and utility classes: [`src/app/globals.css`](/C:/Users/Idris%20Kulubi/Desktop/sidequests/playtt/playtt/src/app/globals.css)
- Marketing shell: [`src/components/layout/marketing-shell.tsx`](/C:/Users/Idris%20Kulubi/Desktop/sidequests/playtt/playtt/src/components/layout/marketing-shell.tsx)
- Product shell: [`src/components/layout/product-shell.tsx`](/C:/Users/Idris%20Kulubi/Desktop/sidequests/playtt/playtt/src/components/layout/product-shell.tsx)
- Auth shell: [`src/components/auth/auth-shell.tsx`](/C:/Users/Idris%20Kulubi/Desktop/sidequests/playtt/playtt/src/components/auth/auth-shell.tsx)

## Tokens
### Color
- Use the theme variables from `globals.css` rather than hardcoding route-level colors.
- `--primary` is reserved for primary CTA emphasis, active states, and focus guidance.
- `--muted-foreground` is for secondary copy only, not for critical labels.

### Spacing
- Use the token rhythm declared in `globals.css` as the baseline mental model:
  - compact: `--space-sm`
  - standard: `--space-md`
  - section: `--space-lg`
  - major break: `--space-xl` and above
- Panels and cards should feel airy, never cramped.

### Radius and Elevation
- Fields: `--radius-field`
- Cards: `--radius-card`
- Panels: `--radius-panel`
- Use `--elevation-soft`, `--elevation-panel`, and `--elevation-strong` by intent, not decoration.

### Motion
- Fast: micro feedback
- Base: default UI state changes
- Slow: shell transitions and hero polish
- Reduced-motion support is required and already defined in `globals.css`.

## Shell Contracts
### Marketing shell
- Purpose: homepage and future product storytelling surfaces
- Includes: brand mark, nav links, global CTA area, page background treatment
- Must support strong first-viewport comprehension and one primary action

### Auth shell
- Purpose: sign-in, sign-up, verify email, password recovery
- Includes: brand story panel on the left and a single clear form surface on the right
- Form content must stay narrow, readable, and distraction-light

### Product shell
- Purpose: dashboard, booking, and future account/product screens
- Includes: brand mark, page header, optional back action, page description, and route-level actions
- Child content should sit below the shell header without re-implementing the page chrome

## Component Contracts
### Buttons
- Primary button: one dominant action per view
- Outline button: secondary navigation or supporting action
- Ghost button: low-emphasis utility or local navigation
- Do not place multiple primary buttons in the same small decision block

### Cards and panels
- `glass-panel`: page shell or high-level section container
- `glass-panel-strong`: premium hero, auth story panel, or high-emphasis product stage
- `premium-card`: interior card, feature block, or selection tile
- Cards must communicate hierarchy by contrast and spacing, not by random extra color

### Fields
- Inputs and textareas use the shared primitives in `src/components/ui`
- Labels should be sentence case
- Helper text must clarify the next action, not restate the label
- Errors should be direct and short

### Form cards
- Use the shared `AuthFormCard` for auth and support flows
- Required anatomy:
  - title
  - concise description
  - form body
  - optional status line
  - footer with one supporting route or instruction

### Step navigation and summary rails
- Booking step navigation must communicate current step, reachable past/future steps, and never overwhelm with explanation
- Summary rails keep context visible on large screens and must collapse intentionally on mobile

### Empty, pending, and error states
- Empty states should tell the user what to do next
- Pending states should sound calm and trustworthy
- Error states should explain the blockage in one sentence and point to recovery

## Responsive Rules
- Mobile first is the default.
- Primary CTAs should stay within comfortable thumb reach where possible.
- Summary or supporting context can move to a right rail on larger screens but must collapse cleanly below `lg`.
- Avoid dense multi-column layouts until the screen size clearly supports them.

## Accessibility Rules
- Maintain visible keyboard focus states on every action and field.
- Keep touch targets large enough for mobile interaction.
- Do not rely on glow, blur, or color alone to signal state.
- Ensure OTP, password, and booking steps can all be completed by keyboard.
