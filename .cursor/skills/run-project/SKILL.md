---
name: run-project
description: Documents how to install, run, lint, build, and database-manage both PlayTT apps. Use when starting dev servers, running builds, setting up env, or when the user asks how to run the project.
---

# Run PlayTT

PlayTT has two independent apps and no root workspace orchestrator. The repo root
`package.json` is the web/API/DB app; `playtt-mobile/package.json` is the Expo app.
Install and run each app from its own directory.
The root app pins pnpm `10.17.1` through `packageManager`; use Corepack or the
same pnpm version so an incompatible wrapper does not try to replace `node_modules`.

## Prerequisites

1. Node.js 22.18 or newer installed
2. `.env.local` at repo root with at least `POSTGRES_URL` (see [env-reference.md](env-reference.md))
3. Run web and mobile in **separate terminals**

## Web + API + DB (repo root)

```bash
pnpm install
pnpm dev          # http://localhost:3000 (Turbopack)
```

If `pnpm` is not on PATH but Node Corepack is available, prefix commands with
`corepack`, for example `corepack pnpm dev`, `corepack pnpm lint`, and
`corepack pnpm typecheck`.

| Script           | Command                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Production build | `pnpm build`                                                       |
| Production serve | `pnpm start`                                                       |
| Lint             | `pnpm lint` (web app only; mobile lint runs from `playtt-mobile/`) |
| Typecheck        | `pnpm typecheck`                                                   |
| Format           | `pnpm format`                                                      |

### Database commands (repo root)

| Script                                     | Command                             |
| ------------------------------------------ | ----------------------------------- |
| Generate migration                         | `pnpm db:generate`                  |
| Apply migrations                           | `pnpm db:migrate`                   |
| Drizzle Studio                             | `pnpm db:studio`                    |
| Seed phase 1                               | `pnpm db:seed`                      |
| Validate migration files                   | `pnpm db:validate`                  |
| Require zero migration drift               | `pnpm db:validate:strict`           |
| Preview VenueEdge v1 topology backfill     | `pnpm db:backfill-venue-edge`       |
| Apply reviewed VenueEdge topology backfill | `pnpm db:backfill-venue-edge:apply` |
| Offline DB safety tests                    | `pnpm test:db`                      |
| PostgreSQL concurrency tests               | `pnpm test:db:integration`          |

Database commands require `POSTGRES_URL` in `.env.local`.
The VenueEdge topology backfill is read-only by default. Review its credential-free
report before using the explicitly confirmed apply command; neither mode deletes
v1 assignments or publishes Config v2.
The validation and validator-test commands are repository-only and do not use
`POSTGRES_URL`. If the bundled `pnpm` wrapper attempts a dependency reinstall,
run their direct Node equivalents documented in
`docs/database/migration-integrity.md`.
The integration suite requires explicit test-only database variables and a
confirmation sentinel; see `docs/database/disposable-postgres-tests.md`. It does
not load `.env.local`. Node 22.18 or newer is the supported baseline for the
repository's dependency-free Node test commands.

## Mobile (`playtt-mobile/`)

```bash
cd playtt-mobile
npm install
npm start            # Expo dev server (uses local CLI via npm script)
```

Use **`npm start`**, not `npx expo start`. On Windows, `npx expo` may resolve to the deprecated global `expo-cli` and fail with missing modules like `@expo/schema-utils`.

| Script        | Command                 |
| ------------- | ----------------------- |
| Android       | `npm run android`       |
| iOS           | `npm run ios`           |
| Web           | `npm run web`           |
| Lint          | `npm run lint`          |
| Reset starter | `npm run reset-project` |

### Mobile troubleshooting

- **`Cannot find module '@expo/schema-utils'`** or legacy expo-cli warning: run `npm install` in `playtt-mobile/` and use `npm start` instead of `npx expo start`.
- **Empty `node_modules/.bin`**: run `npm install` to regenerate CLI shims.
- **Expo version mismatch warnings**: align packages with `npx expo install <package>` from `playtt-mobile/`.

## Typical dev session

1. Terminal 1: `pnpm dev` (repo root)
2. Terminal 2 (optional): `cd playtt-mobile && npm start`

## shadcn components (web only)

```bash
npx shadcn@latest add button
```

## Environment variables

See [env-reference.md](env-reference.md) for all required and optional variables.
