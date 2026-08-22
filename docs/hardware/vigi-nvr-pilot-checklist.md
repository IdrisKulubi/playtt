# VIGI NVR pilot checklist — how to gather evidence and run live tests

**Start here if hardware is already installed:** [vigi-nvr-pilot-walkthrough.md](./vigi-nvr-pilot-walkthrough.md) — full step-by-step from monitor check through `pnpm probe:vigi` and PlayTT hookup.

Use this document for pass criteria and the pilot report template. Record every answer in a short pilot report (template at the bottom) and attach screenshots or command output.

**Official references**

- [VIGI NVR RTSP live + playback FAQ](https://www.tp-link.com/us/support/faq/5223/)
- [VIGI NVR RTSP server setup](https://www.vigi.com/us/support/faq/4677/)

---

## What you need on site

| Item | Why |
| --- | --- |
| Laptop on the **venue LAN** (Ethernet preferred) | RTSP is not exposed to the internet |
| **FFmpeg** installed (`ffmpeg` + `ffprobe` on PATH) | Probe streams and extract test clips |
| NVR **admin** login | Web UI, RTSP auth, firmware info |
| VIGI app or PC client (optional) | Cross-check playback times vs RTSP |
| PlayTT VenueEdge host IP (future) | Same VLAN as cameras/NVR |

---

## 1. Exact VIGI model and firmware version

**Where to find it**

1. NVR local web UI → **Settings → System → Basic Information** (or **Device Info**).
2. Label on the NVR chassis (model + serial).
3. VIGI mobile app → device details (if cloud-bound).

**Record**

- Model (e.g. `VIGI NVR1008H`, `NVR1016H`)
- Hardware revision if shown
- Firmware version + build (e.g. `2.20_1.5.1 Build 260317`)
- Whether **RTSP service** toggle is ON (**Settings → Network → RTSP** or OpenAPI section)

**Pass criteria:** Firmware supports RTSP playback URLs (most recent builds; local-time suffix `l` needs newer firmware per TP-Link release notes).

---

## 2. Live RTSP URL syntax and authentication

**Enable RTSP on the NVR**

- Web UI → **Settings → Network → RTSP** (or **OpenAPI / RTSP service**).
- Note **RTSP port** (default `554`).
- Confirm **Digest authentication** (VIGI default).

**URL formats (TP-Link VIGI)**

| Mode | Format |
| --- | --- |
| Live | `rtsp://{ip}/live/{channel}/{stream}/avm` |
| Playback | `rtsp://{ip}/replay/{channel}/{stream}/avm?starttime={t}&endtime={t}` |

- `channel`: NVR channel number (IPC channels start at **1**).
- `stream`: `1` = main, `2` = sub (must match **Storage Stream** under **Settings → Storage → Recording Control**).

**Authentication**

- RTSP clients use **Digest** (username/password configured on NVR).
- For FFmpeg, embed credentials in the URL (only on LAN, never commit):

```text
rtsp://admin:YOUR_PASSWORD@192.168.1.50/live/1/1/avm
```

**How to verify live**

```bash
# Replace values — run from laptop on venue LAN
ffprobe -rtsp_transport tcp -v error -show_entries stream=codec_name,width,height \
  -of default=noprint_wrappers=1 \
  "rtsp://USER:PASS@NVR_IP/live/1/1/avm"
```

Or use the repo probe script (see **Live test script** below).

**Pass criteria:** `ffprobe` returns a video stream without auth errors; stable for ≥30 seconds.

---

## 3. Playback URL / time semantics for time-bounded extraction

Playback needs a **start** and **end** time in the URL.

**Time format**

| Suffix | Meaning |
| --- | --- |
| `z` | UTC (convert local time to UTC+0) |
| `l` | NVR **local** time (requires supported firmware) |

Format: `YYYYMMDDtHHMMSS` + suffix, e.g. `20260822t120000z`

**Example (UTC)** — 15 seconds of recording around 12:00:00 local in Kenya (UTC+3):

- Local window: 11:59:45 → 12:00:03 (12s pre + 3s post around 12:00:00)
- UTC window: subtract 3 hours → `starttime=20260822t085945z&endtime=20260822t090003z`

```text
rtsp://NVR_IP/replay/1/1/avm?starttime=20260822t085945z&endtime=20260822t090003z
```

**How to validate**

1. In NVR web UI playback, find a known event time (e.g. motion at 12:00:00).
2. Build the RTSP playback URL for that window.
3. Play with VLC or FFmpeg:

```bash
ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@NVR_IP/replay/1/1/avm?starttime=...&endtime=..." \
  -t 15 -c copy -y pilot-playback-test.mp4
```

4. Open `pilot-playback-test.mp4` — content should match the UI playback for that window.

**Pass criteria:** Clip duration ≈ configured window (15s default for PlayTT); content aligns with NVR UI timeline (±2s).

---

## 4. Codec (H.264 compatibility)

**How to check**

```bash
ffprobe -rtsp_transport tcp -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,width,height,r_frame_rate \
  -of json "rtsp://USER:PASS@NVR_IP/live/1/1/avm"
```

**Pass criteria for PlayTT fast path**

- `codec_name` = `h264` → FFmpeg can **remux** (stream copy) to MP4.
- `hevc` / `h265` → works but may need **transcode** fallback (slower on edge).

Record main vs sub stream codec — prefer **substream H.264** for replay if main is H.265.

---

## 5. Clock sync (edge, camera, NVR)

Misaligned clocks cause `buffer_missing` or wrong playback windows.

**Collect**

| Source | How |
| --- | --- |
| NVR | **Settings → System → Date & Time** — timezone, NTP enabled, current time |
| Camera (IPC) | Channel settings or IPC web UI if standalone |
| VenueEdge host | `date` on the machine that will run `services/venue-edge` |

**Live skew test**

1. Note wall-clock time (phone, accurate).
2. Trigger a visible event (wave at camera).
3. Find that moment in NVR playback UI — note timestamp.
4. Delta between wall clock and NVR UI = **display skew** (should be &lt; 2s if NTP is healthy).

**Pass criteria:** All devices use same timezone; NTP on; skew &lt; **2 seconds** for replay window math.

---

## 6. Credential rotation and network isolation

**Credential rotation**

1. Create a dedicated RTSP user (not factory `admin`) with **channel view only**.
2. Change password on NVR → confirm old RTSP URL fails, new password works.
3. Plan: credentials live in **device assignment config** (cloud, encrypted) and VenueEdge **local encrypted store** — never in mobile app or git.

**Network isolation (venue VLAN design)**

| Segment | Devices | Internet |
| --- | --- | --- |
| Cameras + NVR | Camera IPs, NVR | No (ideal) |
| Venue edge | VenueEdge host | Outbound HTTPS to PlayTT + R2 only |
| Staff / guest Wi‑Fi | Tablets, phones | Yes |

**Checks**

- [ ] NVR web UI **not** reachable from guest Wi‑Fi (if segmented).
- [ ] RTSP port **not** exposed on public WAN.
- [ ] VenueEdge can reach NVR IP on LAN and `https://your-playtt-domain` + R2 endpoint.
- [ ] Document static IP or DHCP reservation for NVR and VenueEdge.

---

## Live test script (repo)

From the PlayTT repo root, on a machine on the **venue LAN** with FFmpeg installed:

```bash
# Copy and fill — never commit real credentials
export VIGI_NVR_IP=192.168.1.50
export VIGI_RTSP_USER=playtt_edge
export VIGI_RTSP_PASS=your-secret
export VIGI_CHANNEL=1
export VIGI_STREAM=1          # 1=main, 2=sub
export VIGI_TIME_SUFFIX=z     # z=UTC, l=local (if firmware supports)

pnpm probe:vigi
```

The script:

1. Probes **live** RTSP (codec, resolution).
2. Probes **playback** for the last 15 seconds of recording.
3. Writes `pilot-playback-clip.mp4` and prints a JSON checklist report.

Optional: point at a specific capture instant (UTC):

```bash
export VIGI_CAPTURE_AT=2026-08-22T09:00:00.000Z
pnpm probe:vigi
```

---

## End-to-end pilot with PlayTT (after LAN probe passes)

1. `pnpm db:migrate` — ensure `replay_requests` exists.
2. Enable tenant flags: `private_media`, `replay_edge`.
3. Provision **venue_edge** device + **camera** device; assign to Table 01 resource.
4. Put camera RTSP URL in edge assignment config (server-side only).
5. Run VenueEdge in **buffer** mode with rolling buffer; force fallback test by stopping buffer or setting `sourceType` to `nvr_playback` in a staging command.
6. Set `VENUE_EDGE_ALLOW_VIGI_ADAPTER=true` **only on staging edge**, not production until checklist signed off.

---

## Pilot report template

Copy into your venue runbook or ticket:

```markdown
## VIGI pilot — [Venue name] — [Date]

- Model:
- Firmware:
- RTSP port:
- Channel / table mapping: CH1 = Table 01, ...
- Storage stream: main / sub
- Live RTSP URL (redacted): rtsp://***@IP/live/1/1/avm
- Playback time mode: UTC (z) / local (l)
- Video codec (live): h264 / h265 / other
- Clock skew (NVR vs wall): ___ seconds
- NTP enabled: yes / no
- Dedicated RTSP user rotated: yes / no
- Guest Wi‑Fi cannot reach NVR: yes / no
- Live ffprobe: pass / fail
- Playback 15s clip: pass / fail
- PlayTT edge upload test: pass / fail / not run
- Sign-off:
```

---

## When checklist is complete

1. Fill `VIGI_MODEL` and playback URL builder in `VigiNvrPlaybackAdapter`.
2. Add model-specific fixture to `services/venue-edge/test/`.
3. Remove production block or gate on `VENUE_EDGE_ALLOW_VIGI_ADAPTER` with ops approval.
4. Mark checklist items in [replay-edge.md](../platform/replay-edge.md) and master build checklist.
