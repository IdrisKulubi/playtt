# ESP32-S3-N16R8 PlayTT controller

Flashable firmware for the PlayTT device v1 HTTPS protocol. Targets **ESP32-S3-N16R8** and talks to hosted PlayTT at **https://www.theplaytt.com** by default.

## Hardware

| Pin | Role |
|-----|------|
| GPIO15 | Side A (red button switch) |
| GPIO16 | Side B (blue button switch) |
| GND | Both button grounds |
| GPIO0 | BOOT button (also scores side A for smoke tests) |
| GPIO2 | Status LED |

Wire each button between its GPIO and **GND** (active low, internal pull-up).

| Button | Wire | ESP32 pin |
|--------|------|-----------|
| Red | switch pin | GPIO15 (side A) |
| Red | switch pin | GND |
| Blue | switch pin | GPIO16 (side B) |
| Blue | switch pin | GND |

## Prerequisites (Windows)

1. Install [ESP-IDF 5.4+](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/windows-setup.html) (6.x works; `main/idf_component.yml` pulls `espressif/cjson`)
2. Open **ESP-IDF PowerShell** (activate the IDF environment)
3. Operator account on https://www.theplaytt.com
4. Enrollment code from https://www.theplaytt.com/operator/devices (`esp32_controller`)

Hosted production must include device v1 + scoring APIs (P3-01–P3-07). If `/api/device/v1/provision` returns 404, deploy this branch first.

## Flash

```bash
cd firmware/esp32-controller
idf.py set-target esp32s3
idf.py build
idf.py -p COMx flash monitor
```

Replace `COMx` with the **USB JTAG/serial debug unit** port from Device Manager (not a secondary UART port). If the port is missing, hold **BOOT**, tap **RESET**, then retry.

If `set-target` refuses to clean a stale `build/` folder, delete it manually then rerun `idf.py set-target esp32s3`.

After flash, if the monitor shows `waiting for download`, press **RESET** once (without holding BOOT).

## Easiest setup: from the admin dashboard (no IDE)

In **Chrome or Edge on a computer**, open **Admin → Devices → Set up controller** (`/admin/devices/setup`), plug the ESP32 into the **USB** port (not COM/UART) with a data cable and press **Connect**. From there you can:

- **Install or update firmware** in the browser (brand-new boards included). Updates write the bootloader, partition table and app at their own offsets, so saved Wi-Fi and registration are kept.
- **See status**: Wi-Fi network and signal, saved networks, registration, last server error.
- **Change Wi-Fi**: up to 3 networks, tried in order (e.g. venue router, backup router, phone hotspot). Passwords are never read back.
- **Register and assign**: creates the enrollment code, sends it, waits for the device to appear and assigns it to the chosen table as score input.

If a brand-new board isn't detected, hold **BOOT**, tap **RESET**, release BOOT and try again.

### Publishing a firmware build for the dashboard

```bash
cd firmware/esp32-controller && idf.py build && cd ../..
node scripts/publish-esp32-firmware.mjs   # -> public/firmware/esp32-controller/
```

Bump `PLAYTT_FIRMWARE_VERSION` in `main/playtt_config.h` for every release so the page can offer the update.

## Setup hotspot (no computer needed)

If none of the saved networks connect for 2 minutes, the controller opens an open Wi-Fi network **`PlayTT-Setup-xxxxxx`**. Join it with a phone; a sign-in page appears (or open `http://192.168.4.1`). Pick the new Wi-Fi and save; the controller restarts and joins it, keeping its registration. While the hotspot is up it retries the saved networks every 3 minutes.

## USB serial protocol

Send one JSON object per line; replies are one line prefixed with `@@PLAYTT `:

| Command | Effect |
|---------|--------|
| `{"cmd":"info"}` | Firmware, stage, Wi-Fi status, saved network names, registration, last error |
| `{"cmd":"scan"}` | Nearby 2.4 GHz networks |
| `{"cmd":"set_wifi","networks":[{"ssid":"…","password":"…"}]}` | Replace saved networks, restart |
| `{"cmd":"register","enrollmentCode":"…","server":"https://…","networks":[…]}` | New registration (fresh hardware UID), restart |
| `{"cmd":"reboot"}` / `{"cmd":"forget"}` | Restart / erase all settings |

## Setup from a serial monitor

Type `setup` + Enter and answer the prompts (Wi-Fi name, password, enrollment code). Expected log sequence:

```text
wifi ok
sntp ok
provisioned device <uuid>
config vN role=score_input
heartbeat ok
```

## Operator setup (hosted)

1. Create enrollment at https://www.theplaytt.com/operator/devices
2. After provision, assign device to a resource with role **score_input**
3. Ensure an **active** play session exists on that resource
4. Open TV: `https://www.theplaytt.com/pod/tv?resourceId=<uuid>`

## Score without buttons

In the serial monitor:

- `a` — point for side A
- `b` — point for side B
- `u` — correction undo on side A
- `w` — change Wi-Fi SSID/password (keeps enrollment; the new network goes first, the others stay as backups; the board restarts after saving)
- `g` — print button pin levels

Pressing the red (A) or blue (B) table buttons, or BOOT, should update the hosted TV/kiosk.

## Reset / reprovision

```bash
idf.py erase-flash
idf.py flash monitor
```

Then create a **new** enrollment code on theplaytt.com (codes are one-time).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| TLS / cert errors | SNTP must succeed first; check internet |
| `SESSION_INACTIVE` | Start/confirm active play session on assigned resource |
| `SCORE_FORBIDDEN` | Assignment role must be `score_input` |
| Provision 404 | Deploy latest PlayTT to production |
| `SEQUENCE_GAP` | Firmware now starts sequence 1 on each boot; reflash if you still see leftover seq numbers |

## Protocol reference

Shared contract: [`firmware/protocol/`](../protocol/) and [`firmware/protocol/fixtures/device-v1.json`](../protocol/fixtures/device-v1.json).

Signed OTA / Secure Boot: [`docs/hardware/firmware-ota-policy.md`](../../docs/hardware/firmware-ota-policy.md)
