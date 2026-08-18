# ESP32-S3-N16R8 PlayTT controller

Flashable firmware for the PlayTT device v1 HTTPS protocol. Targets **ESP32-S3-N16R8** and talks to hosted PlayTT at **https://www.theplaytt.com** by default.

## Hardware

| Pin | Role |
|-----|------|
| GPIO4 | Side A button (active low, internal pull-up) |
| GPIO5 | Side B button (active low, internal pull-up) |
| GPIO0 | BOOT button (also scores side A for smoke tests) |
| GPIO2 | Status LED |

Wire each button between the GPIO and **GND**.

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

## First boot wizard

The serial monitor prompts for:

0. Press **Enter** once when connected (setup waits for input)
1. Wi-Fi SSID
2. Wi-Fi password
3. Enrollment code
4. Base URL override (press Enter for `https://www.theplaytt.com`)
5. Hardware UID (Enter for auto)

Expected log sequence:

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

Pressing GPIO buttons or BOOT should update the hosted TV/kiosk.

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
| `SEQUENCE_GAP` | Reboot board (new bootId) or erase NVS |

## Protocol reference

Shared contract: [`firmware/protocol/`](../protocol/) and [`firmware/protocol/fixtures/device-v1.json`](../protocol/fixtures/device-v1.json).

Signed OTA / Secure Boot: [`docs/hardware/firmware-ota-policy.md`](../../docs/hardware/firmware-ota-policy.md)
