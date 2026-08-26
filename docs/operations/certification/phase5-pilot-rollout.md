# Phase 5 pilot rollout

Enable Phase 5 tenant flags **independently** only after physical commissioning succeeds.

## Default (all environments)

Keep rollout flags disabled in seed and production until evidence exists:

- `live_access`
- `ttlock_provider`
- `relay_automation`
- `access_notifications`
- `remote_unlock`

Keep `TTLOCK_PROVIDER_MODE=simulator` until Sciener commissioning is complete.

## Recommended order

1. **Inventory only** — enable `ttlock_provider`, sync locks, assign access points. Leave `live_access` off.
2. **Internal booking** — one Hurlingham / Table 01 paid booking with real provider; verify provision/reveal in app.
3. **Keypad acceptance** — complete [ttlock-keypad-acceptance.md](./ttlock-keypad-acceptance.md).
4. **Live access** — enable `live_access` for the commissioned venue only.
5. **Notifications** — enable `access_notifications` after Expo push is configured on a physical build.
6. **Remote unlock** — enable `remote_unlock` only after OTP pepper and operator training.

## Enable flags (tenant DB)

Preview (no writes):

```bash
node --env-file=.env.local scripts/enable-phase5-pilot-flags.mjs
```

After Hurlingham / Table 01 commissioning:

```bash
node --env-file=.env.local scripts/enable-phase5-pilot-flags.mjs \
  --confirm-commissioned \
  --enable live_access,ttlock_provider,access_notifications
```

Dry run with confirmation guard:

```bash
node --env-file=.env.local scripts/enable-phase5-pilot-flags.mjs \
  --confirm-commissioned \
  --dry-run \
  --enable live_access
```

## Environment variables

See `.cursor/skills/run-project/env-reference.md` for:

- `TTLOCK_PROVIDER_MODE`
- `PLAYTT_CREDENTIAL_KEYRING`
- `PLAYTT_PASSCODE_FINGERPRINT_KEY`
- `PLAYTT_REMOTE_UNLOCK_OTP_PEPPER`
- Phase 5 feature-flag env overrides

## Exit gate

Do not mark Phase 5 **Complete** until [phase5-two-venue-acceptance.md](./phase5-two-venue-acceptance.md) is signed off.
