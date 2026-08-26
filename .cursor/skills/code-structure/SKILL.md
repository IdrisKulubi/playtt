---
name: code-structure
description: Maps PlayTT folders, conventions, and where to add new code. Use when onboarding, exploring the codebase, or deciding where a feature belongs.
---

# PlayTT Code Structure

## Overview

| Directory | Stack | Role |
|-----------|-------|------|
| Repo root | Next.js 16, React 19, Drizzle, better-auth, pnpm | Web, admin, API, database |
| `playtt-mobile/` | Expo 54, React Native, Expo Router, npm | Mobile app |
| `services/venue-edge/` | Node 22, SQLite, FFmpeg | Venue-local replay capture |

There is no shared package or root workspace orchestrator.

## Web app layers (repo root)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Routes | `src/app/` | App Router pages + `api/auth/[...all]`; Super Admin console at `src/app/admin/` (`/admin/*`; legacy `/operator/*` redirects) |
| Actions | `src/actions/` | Server Actions (thin; delegate to server/) |
| Domain | `src/server/bookings/` | service, repository, pricing, validators, types, constants |
| Admin | `src/server/admin/` | Super Admin analytics, members, vendors; gate at `gate.ts` |
| Operator (legacy reads) | `src/server/operator/` | Tenant catalog reads, durable work; shared with admin shell |
| UI | `src/components/` | auth, bookings, home, layout, ui (shadcn) |
| Emails | `src/emails/` | React Email templates |
| DB | `db/` | Drizzle schema + client |
| Auth config | `auth.ts` | better-auth server setup (includes Expo plugin for mobile) |
| Migrations | `drizzle/` | Generated SQL migrations |
| Docs | `docs/` | Product, design, architecture |

## Mobile app (`playtt-mobile/`)

| Path | Responsibility |
|------|----------------|
| `app/` | Expo Router screens (file-based routing) |
| `app/(app)/(tabs)/` | Auth-gated tab screens (Home, Explore) |
| `app/(app)/_layout.tsx` | Session gate; redirects to `/sign-in` |
| `app/sign-in.tsx`, `app/sign-up.tsx` | Auth screens |
| `app/book.tsx`, `app/index.tsx` | Booking and marketing |
| `components/` | auth, brand, layout, ui, themed primitives |
| `lib/` | auth-client, auth-schemas, auth-navigation, env |
| `hooks/` | Color scheme and theme hooks |
| `constants/` | `playtt-tokens.ts`, `theme.ts` |
| `docs/` | Product, design system, requirements |

## Where to put new code

| Task | Location |
|------|----------|
| New booking/API logic | `src/server/bookings/` + thin action in `src/actions/` |
| New web page | `src/app/<route>/page.tsx` |
| New auth UI | `src/components/auth/` |
| New booking UI | `src/components/bookings/` |
| New email template | `src/emails/` |
| New mobile screen | `playtt-mobile/app/` (Expo Router) |
| Schema change | `db/schema.ts` + migration (use `db-dev` agent) |
| shadcn component | `npx shadcn@latest add <name>` → `src/components/ui/` |

## Import aliases (web)

From `components.json`:

- `@/components` — components
- `@/components/ui` — shadcn primitives
- `@/lib` — utilities
- `@/hooks` — hooks

Pure modules imported directly by dependency-free `node --test` files must use
relative imports for other pure modules; Node does not resolve the `@/` alias
outside the Next.js/TypeScript toolchain.

## Subagent routing

| Work type | Agent |
|-----------|-------|
| Next.js, auth, bookings, emails | `web-dev` |
| Expo, React Native, mobile UI | `mobile-dev` |
| Schema, migrations, seed | `db-dev` |

## Additional reference

- Route list and planned integrations: [reference.md](reference.md)
- How to run apps: `.cursor/skills/run-project/SKILL.md`
