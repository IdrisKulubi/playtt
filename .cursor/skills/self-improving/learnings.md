# PlayTT Agent Learnings

## 2026-08-18 — Production /operator gate

- **Context:** Same operator account could open `/operator` on localhost but was redirected to `/dashboard` on theplaytt.com.
- **Fix:** Production requires an enabled `operator_shell` feature-flag row (or `OPERATOR_SHELL_ENABLED=true`). Localhost falls back to `NODE_ENV !== "production"`. Role must still be `support`, `operator`, or `owner`.
- **Updated:** `run-project/env-reference.md`, `db/seed-phase1.sql`

## 2026-06-06 — Repo flatten

- **Context:** Nested `playtt/playtt/` was flattened so the web app lives at repo root; mobile moved to `playtt-mobile/`.
- **Fix:** Agent docs must use repo root paths (`src/`, `db/`) and `playtt-mobile/`, not `playtt/` or `mobile/playtt/`.
- **Updated:** `AGENTS.md`, `.cursor/skills/`, `.cursor/agents/`

## 2026-06-06 — Package managers

- **Context:** Web app uses pnpm (`pnpm-lock.yaml`); mobile uses npm (`package-lock.json`).
- **Fix:** Web commands use `pnpm`; mobile commands use `npm` from `playtt-mobile/`.
- **Updated:** `run-project/SKILL.md`, subagent files

## 2026-06-06 — Expo CLI on Windows

- **Context:** `npx expo start` resolved to deprecated global `expo-cli`, causing `@expo/schema-utils` errors.
- **Fix:** Use `npm start` in `playtt-mobile/` (runs local Expo CLI). Re-run `npm install` if `node_modules/.bin` is empty.
- **Updated:** `run-project/SKILL.md`, `mobile-dev.md`

## 2026-06-06 — Expo SDK 54 package versions

- **Context:** `expo-network@56.x` and `expo-secure-store@56.x` triggered compatibility warnings on SDK 54.
- **Fix:** Use `expo-network@~8.0.8` and `expo-secure-store@~15.0.8` (or `npx expo install <pkg>`).
- **Updated:** `playtt-mobile/package.json`
