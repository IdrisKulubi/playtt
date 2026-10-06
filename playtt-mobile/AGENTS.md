See the repo-root [AGENTS.md](../AGENTS.md) for PlayTT agent guide, skills, and subagent routing. For mobile work, use the `mobile-dev` subagent in [`.cursor/agents/mobile-dev.md`](../.cursor/agents/mobile-dev.md).

For floating glass UI (tab bar, segments, panels), read [liquid-glass-ui](../.cursor/skills/liquid-glass-ui/SKILL.md) first.

## Mobile is a shell — backend lives in the web app

The mobile app does **not** own business logic, database access, or heavy computation. The repo-root Next.js app (`src/app/api/`, `src/server/`) is the backend.

| Mobile (`playtt-mobile/`) | Web (repo root) |
|---------------------------|-----------------|
| Screens, navigation, native UX (camera, push, haptics) | Drizzle, Postgres, bookings, replays, coach, auth |
| Thin `lib/*-api.ts` modules that call `apiFetch` | Route handlers + `src/server/*` services |
| `lib/mock/*` only for **offline UI preview** (badged Sample/Preview) | Source of truth for all persisted data |

**Rules for agents**

1. New data or behavior → implement API + server logic in the web app first; mobile only adds types, `apiFetch` wrapper, and UI.
2. Do not add SQLite, background sync engines, or domain rules in mobile beyond presentation (formatting, sorting for display is OK).
3. Use `EXPO_PUBLIC_API_URL` / [`lib/api-client.ts`](lib/api-client.ts) for all live calls.
4. Mocks are temporary; live paths should call the same endpoints the web app exposes (e.g. Activity clips → `GET /api/replays/mine`, `GET /api/replays/credits`).