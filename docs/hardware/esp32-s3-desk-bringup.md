# ESP32-S3 desk bring-up (hosted)

Quick checklist for flashing your **ESP32-S3-N16R8** against production PlayTT.

## Before you flash

- [ ] ESP-IDF 5.4 installed (Windows PowerShell shortcut)
- [ ] USB-C data cable connected
- [ ] Operator login on https://www.theplaytt.com
- [ ] Latest device/scoring code deployed to production

## Operator steps

1. Go to https://www.theplaytt.com/admin/devices
2. Create enrollment → type **esp32_controller** → copy code
3. Flash firmware (see [`firmware/esp32-controller/README.md`](../../firmware/esp32-controller/README.md))
4. Complete serial wizard (Wi-Fi + enrollment code)
5. Assign provisioned device to a table resource → role **score_input**
6. Confirm device shows **online**
7. Ensure table has an **active** play session
8. Open `https://www.theplaytt.com/pod/tv?resourceId=<uuid>`

## Verify scoring

- Serial: type `a` then `b`
- Or press red (GPIO15 / side A) / blue (GPIO16 / side B) / BOOT
- TV and scoreboard should update within a few seconds

## Offline test

1. Disconnect Wi-Fi router briefly (or move ESP out of range)
2. Press `a` a few times (events buffer locally)
3. Restore Wi-Fi
4. Events replay in order without double-scoring

## Done when

- Device online on operator devices page
- Hosted TV updates from ESP32 input
- Offline buffer replays cleanly

Tick the physical HIL checkbox in [`docs/platform/master-build-checklist.md`](../platform/master-build-checklist.md) after this passes.
