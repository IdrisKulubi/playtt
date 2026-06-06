---
name: run-project
description: Documents how to install, run, lint, build, and database-manage both PlayTT apps. Use when starting dev servers, running builds, setting up env, or when the user asks how to run the project.
---

# Run PlayTT

PlayTT has two apps with **no root package.json**. Each app installs and runs independently.

## Prerequisites

1. Node.js installed
2. `.env.local` at repo root with at least `POSTGRES_URL` (see [env-reference.md](env-reference.md))
3. Run web and mobile in **separate terminals**

## Web + API + DB (repo root)

```bash
pnpm install
pnpm dev          # http://localhost:3000 (Turbopack)
```

| Script | Command |
|--------|---------|
| Production build | `pnpm build` |
| Production serve | `pnpm start` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Format | `pnpm format` |

### Database commands (repo root)

| Script | Command |
|--------|---------|
| Generate migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Drizzle Studio | `pnpm db:studio` |
| Seed phase 1 | `pnpm db:seed` |

Database commands require `POSTGRES_URL` in `.env.local`.

## Mobile (`playtt-mobile/`)

```bash
cd playtt-mobile
npm install
npm start            # Expo dev server (uses local CLI via npm script)
```

Use **`npm start`**, not `npx expo start`. On Windows, `npx expo` may resolve to the deprecated global `expo-cli` and fail with missing modules like `@expo/schema-utils`.

| Script | Command |
|--------|---------|
| Android | `npm run android` |
| iOS | `npm run ios` |
| Web | `npm run web` |
| Lint | `npm run lint` |
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
