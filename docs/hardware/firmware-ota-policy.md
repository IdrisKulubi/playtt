# PlayTT firmware OTA policy

This document defines how venue ESP32 controllers stay compatible with PlayTT device APIs and how signed OTA is staged for production.

## API compatibility

- Firmware reports `firmwareVersion` on provision and heartbeat.
- Resource-specific behavior comes from `GET /api/device/v1/config`; firmware must not hardcode table IDs or venue settings.
- Breaking HTTP contract changes require a new API version (`/api/device/v2`). Existing devices remain on v1 until explicitly migrated.

## Simulator-first rollout

1. Validate protocol with `pnpm sim:device` against staging/local PlayTT.
2. Flash one staging ESP32 with the same protocol library semantics.
3. Enable venue resources only after hosted HIL passes.

## Signed OTA (production gate)

Production venue installs require:

- ESP-IDF app image signing with rollback protection
- OTA images delivered over HTTPS from a PlayTT-controlled release channel
- Minimum firmware version enforced server-side when needed

This repository does **not** ship an OTA server in Phase 3. OTA signing keys and CDN delivery are staged before the first production pod install.

## Secure Boot and flash encryption

Required before venue install, not before simulator merge:

- Secure Boot v2 enabled on production boards
- Flash encryption for credential NVS partitions
- Factory provisioning workflow that never logs raw device secrets

## Rollback

If a firmware release misbehaves:

1. Disable score ingestion for the affected resource/venue via feature flags.
2. Roll devices back to the last signed known-good image.
3. Retain committed score events and device registry rows; do not delete durable history.
