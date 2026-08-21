# PlayTT Agent Guide

This repo contains two independent apps. Read the skills below before making changes.

## Monorepo map

| Directory | Role |
|-----------|------|
| Repo root (`src/`, `db/`, `auth.ts`, …) | Next.js web app, API, auth, bookings, database |
| `playtt-mobile/` | Expo mobile app |
| `services/venue-edge/` | VenueEdge replay capture service (one per venue) |

There is no root workspace orchestrator. Install and run each app from its own directory.

## Skills (read first)

| Skill | Path | When to use |
|-------|------|-------------|
| Run project | `.cursor/skills/run-project/SKILL.md` | Starting dev servers, builds, database setup |
| Code structure | `.cursor/skills/code-structure/SKILL.md` | Finding files, adding features, onboarding |
| Self-improving | `.cursor/skills/self-improving/SKILL.md` | After fixing outdated docs or discovering new conventions |

## Subagent routing

Delegate to the right specialist when the task is domain-specific:

| Task | Subagent | Directory |
|------|----------|-----------|
| Next.js pages, server actions, auth, bookings, emails, shadcn | `web-dev` | Repo root (`src/`, `auth.ts`, …) |
| Expo Router, React Native, mobile UI | `mobile-dev` | `playtt-mobile/` |
| Drizzle schema, migrations, seed data | `db-dev` | `db/`, `drizzle/` |

Subagent files: `.cursor/agents/`

## Quick start

```bash
# Web (terminal 1)
pnpm install && pnpm dev

# Mobile (terminal 2, optional)
cd playtt-mobile && npm install && npm start
```

See `.cursor/skills/run-project/SKILL.md` for full commands and environment setup.
