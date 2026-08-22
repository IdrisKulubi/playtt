# VIGI NVR pilot — step-by-step walkthrough

**You already have:** NVR, cameras, and monitor connected. This guide walks you through the rest: network access, RTSP setup, live tests, playback tests, and hooking up PlayTT.

**Time needed:** about 1–2 hours on site.

**Companion docs**

- Checklist + pass criteria: [vigi-nvr-pilot-checklist.md](./vigi-nvr-pilot-checklist.md)
- Replay architecture: [replay-edge.md](../platform/replay-edge.md)

**Official TP-Link help**

- [RTSP live + playback URLs](https://www.tp-link.com/us/support/faq/5223/)
- [RTSP server setup](https://www.vigi.com/us/support/faq/4677/)

---

## What you are trying to prove

Before PlayTT uses the NVR as a **fallback** clip source, you must confirm:

1. You can pull **live** video from each table camera over RTSP.
2. You can pull a **15-second slice** from recorded footage using start/end times in the URL.
3. Video is **H.264** (or you know you need transcoding).
4. NVR clock matches real time (replay windows land on the right moment).
5. Credentials and network are safe (not on guest Wi‑Fi / internet).

---

## Part A — Verify what you already set up

### Step 1 — Cameras show on the monitor

1. Turn on the monitor connected to the NVR (HDMI/VGA from NVR).
2. Use the NVR front panel or mouse (if local UI) to open **Live View**.
3. Confirm every camera channel shows a picture (not “No signal”).

**✓ Pass:** Each table camera has a live image.  
**✗ Fail:** Black screen → check camera power, PoE, cable, and that the channel is added in NVR **Channel Management**.

### Step 2 — Recording is actually happening

1. On the NVR UI or web interface, open **Playback**.
2. Pick **today**, select a camera channel, and scrub the timeline.
3. You should see continuous or motion-based recording blocks.

**✓ Pass:** Recorded segments exist for the last hour.  
**✗ Fail:** Empty timeline → check **Settings → Storage** (HDD installed, not full, recording schedule enabled).

### Step 3 — Write down your channel map

On paper or in the pilot report, note which NVR channel = which table:

| NVR channel | Camera location | PlayTT resource (later) |
| --- | --- | --- |
| 1 | Table 01 overhead | Table 01 |
| 2 | Table 02 overhead | Table 02 |
| … | … | … |

You will use **channel number** in every RTSP URL (`/live/1/...` = channel 1).

---

## Part B — Connect your laptop to the venue network

### Step 4 — Same network as the NVR

1. Plug the laptop into the **same router/switch** as the NVR (Ethernet is best), **or** join the venue staff Wi‑Fi (not guest Wi‑Fi if you have both).
2. Disable VPN if it blocks local IPs.

**✓ Pass:** Laptop can reach local devices (you’ll confirm in Step 6).

### Step 5 — Find the NVR IP address

**Option A — NVR local screen**

- **Settings → Network → TCP/IP** (or similar) → note **IP Address** (e.g. `192.168.0.240`).

**Option B — From the router**

- Log into the venue router admin → **Connected devices** → find “VIGI” or the NVR MAC label.

**Option C — VIGI app**

- Device info often shows local IP when phone is on same Wi‑Fi.

**Write down:**

```text
NVR_IP = _______________
```

Give the NVR a **fixed IP** (DHCP reservation in router) so it never changes after reboot.

### Step 6 — Open the NVR in a browser

1. On the laptop, open Chrome/Edge.
2. Go to `http://NVR_IP` (example: `http://192.168.0.240`).
3. Log in with your NVR admin username and password.

**✓ Pass:** NVR web dashboard loads.  
**✗ Fail:** Page won’t load → wrong IP, laptop on wrong network, or NVR web port blocked. Try `https://NVR_IP` if HTTP fails.

---

## Part C — Record model, firmware, and enable RTSP

### Step 7 — Model and firmware (checklist item 1)

1. In web UI: **Settings → System → Basic Information** (names vary slightly by model).
2. Copy into your notes:

```text
Model:     _______________
Firmware:  _______________
Serial:    _______________
```

3. Take a screenshot for the pilot file.

### Step 8 — Turn on RTSP (checklist item 2)

1. Go to **Settings → Network → RTSP** (or **OpenAPI / RTSP service**).
2. Enable **RTSP service**.
3. Note **RTSP port** (usually `554`).
4. Leave authentication enabled (Digest).

**Write down:**

```text
RTSP port: ___
RTSP enabled: yes
```

### Step 9 — Which stream is recorded? (main vs sub)

1. **Settings → Storage → Recording Control → Storage Stream**.
2. Note whether recording uses **Main stream** or **Sub stream**.

| Storage setting | Use in RTSP URL `stream` param |
| --- | --- |
| Main stream recorded | `1` |
| Sub stream recorded | `2` |

**Write down:**

```text
Storage stream: main / sub  →  RTSP stream number: 1 or 2
```

If playback later fails, wrong stream number is a common cause.

### Step 10 — Date, time, and NTP (checklist item 5)

1. **Settings → System → Date & Time** (or **Basic Settings → Date**).
2. Set **time zone** correctly (e.g. `(UTC+03:00) Nairobi`).
3. Enable **NTP** / automatic time sync.
4. Confirm displayed time matches your phone’s time (within a few seconds).

**Write down:**

```text
Timezone: _______________
NTP enabled: yes / no
Skew vs phone: ___ seconds
```

---

## Part D — Create a dedicated RTSP user (checklist item 6)

Do **not** use the factory `admin` password in PlayTT long term.

### Step 11 — Add user for PlayTT edge

1. **Settings → System → User Management** (or **Account**).
2. Create user e.g. `playtt_edge` with a **strong password**.
3. Permissions: **live view + playback** only (no config changes if the UI allows restricting).

**Write down** (keep password in a password manager, not in git):

```text
RTSP user: playtt_edge
RTSP pass: (stored securely)
```

### Step 12 — Test password works

You’ll verify in Step 15 with VLC. Wrong password shows “401 Unauthorized” or connection failed.

---

## Part E — Install tools on your Windows laptop

### Step 13 — Install FFmpeg

**Option A — winget (recommended on Windows 11)**

```powershell
winget install Gyan.FFmpeg
```

Close and reopen PowerShell, then check:

```powershell
ffmpeg -version
ffprobe -version
```

**Option B — Download**

1. Go to https://www.gyan.dev/ffmpeg/builds/ → download `ffmpeg-release-essentials.zip`.
2. Extract and add the `bin` folder to your PATH.

### Step 14 — Install VLC (optional but helpful)

1. Download VLC from https://www.videolan.org/
2. Used for quick “does this URL play?” before FFmpeg.

---

## Part F — Live RTSP test (checklist items 2 + 4)

Replace placeholders:

- `NVR_IP` — from Step 5
- `USER` / `PASS` — from Step 11
- `CHANNEL` — e.g. `1` for Table 01
- `STREAM` — `1` or `2` from Step 9

### Step 15 — Live view in VLC

1. Open VLC → **Media → Open Network Stream**.
2. Enter:

```text
rtsp://USER:PASS@NVR_IP/live/CHANNEL/STREAM/avm
```

Example:

```text
rtsp://playtt_edge:YourPassword@192.168.0.240/live/1/1/avm
```

3. Click **Play**.

**✓ Pass:** Live video from the table camera.  
**✗ Fail:**

| Symptom | Fix |
| --- | --- |
| Unauthorized | Wrong user/password |
| Connection failed | Wrong IP, RTSP off, or firewall |
| No video | Wrong channel or stream number |

### Step 16 — Live codec check with ffprobe

In PowerShell (one line URL):

```powershell
ffprobe -rtsp_transport tcp -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=noprint_wrappers=1 "rtsp://USER:PASS@NVR_IP/live/CHANNEL/STREAM/avm"
```

**✓ Pass:** Prints something like:

```text
codec_name=h264
width=1920
height=1080
```

**Note:** `h264` = PlayTT fast path. `hevc` or `h265` = still works but slower on the edge PC.

---

## Part G — Playback RTSP test (checklist item 3)

PlayTT needs **recorded** footage for a **15-second window**: 12 seconds before the moment + 3 seconds after.

### Step 17 — Pick a known moment in NVR playback UI

1. In NVR web UI, open **Playback** for channel 1.
2. Find a time where you know what happened (e.g. you waved at the camera at **14:30:00**).
3. Write that time down:

```text
Event local time: 2026-08-22 14:30:00  (example)
```

### Step 18 — Build the playback RTSP URL

**URL shape:**

```text
rtsp://USER:PASS@NVR_IP/replay/CHANNEL/STREAM/avm?starttime=START&endtime=END
```

**Time format:** `YYYYMMDDtHHMMSS` + suffix

| Suffix | When to use |
| --- | --- |
| `z` | Times converted to **UTC** |
| `l` | NVR **local** time (newer firmware only) |

**Kenya example (UTC+3)** — event at 14:30:00 local, 15s window (11:59:45–12:00:03 style):

For event at **14:30:00** local, window **14:29:48 → 14:30:03** (12s before + 3s after):

- Local: `starttime=20260822t142948l&endtime=20260822t143003l` — only if firmware supports `l`
- UTC: subtract 3 hours → `starttime=20260822t112948z&endtime=20260822t113003z`

Full URL example (UTC):

```text
rtsp://playtt_edge:YourPassword@192.168.0.240/replay/1/1/avm?starttime=20260822t112948z&endtime=20260822t113003z
```

### Step 19 — Play playback URL in VLC

1. VLC → **Open Network Stream** → paste the **playback** URL (not live).
2. Play for ~15 seconds.

**✓ Pass:** You see the same moment you picked in Step 17.  
**✗ Fail:** Wrong time math, wrong `z` vs `l`, or wrong stream/channel.

### Step 20 — Save a test clip with FFmpeg

```powershell
ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@NVR_IP/replay/CHANNEL/STREAM/avm?starttime=START&endtime=END" -c copy -y pilot-playback-test.mp4
```

Open `pilot-playback-test.mp4` in VLC. Duration should be ~15 seconds and content should match the NVR UI.

---

## Part H — Clock sync test (checklist item 5)

### Step 21 — Wave test

1. Note phone time: **14:35:00** (example).
2. Stand under the camera and wave for 5 seconds.
3. In NVR **Playback**, find your wave on the timeline.

**✓ Pass:** NVR timestamp is within **2 seconds** of when you waved.  
**✗ Fail:** Fix NTP and timezone in Step 10 before trusting automated replay windows.

---

## Part I — Automated probe (PlayTT repo)

Do this from the PlayTT project on the laptop (same LAN).

### Step 22 — Clone / open project and set variables

```powershell
cd "C:\Users\Idris Kulubi\Desktop\sidequests\playtt"

$env:VIGI_NVR_IP="192.168.0.240"
$env:VIGI_RTSP_USER="playtt_edge"
$env:VIGI_RTSP_PASS="your-password-here"
$env:VIGI_CHANNEL="1"
$env:VIGI_STREAM="1"
$env:VIGI_TIME_SUFFIX="z"
```

If your firmware supports local-time URLs and you prefer `l`:

```powershell
$env:VIGI_TIME_SUFFIX="l"
```

Optional — test a specific capture instant (UTC ISO string):

```powershell
$env:VIGI_CAPTURE_AT="2026-08-22T11:30:00.000Z"
```

### Step 23 — Run the probe

```powershell
pnpm probe:vigi
```

**✓ Pass:**

- Console shows live + playback probes OK
- File `pilot-playback-clip.mp4` plays correctly
- File `vigi-pilot-report.json` created

**✗ Fail:** Read the error — usually auth, channel, stream, or time format.

---

## Part J — Security checks (checklist item 6)

### Step 24 — Rotate password

1. Change `playtt_edge` password on the NVR.
2. Old RTSP URL in VLC should **fail**.
3. New password should **work**.

### Step 25 — Network isolation

| Check | How |
| --- | --- |
| NVR not on public internet | From outside the venue network, you cannot open `http://NVR_IP` |
| Guest Wi‑Fi isolated (if used) | From guest Wi‑Fi, NVR web UI should **not** load (if you designed VLANs that way) |
| RTSP not exposed to WAN | Router has no port-forward for 554 to NVR |

Document router DHCP reservations:

```text
NVR fixed IP:     _______________
Edge PC IP:       _______________  (future VenueEdge host)
```

---

## Part K — Connect to PlayTT (after LAN tests pass)

Only do this when Steps 15–23 pass.

### Step 26 — Database and flags

On your dev machine (with `.env.local` pointed at Neon/local DB):

```powershell
cd "C:\Users\Idris Kulubi\Desktop\sidequests\playtt"
pnpm db:migrate
```

Enable in database for your tenant (or via seed):

- `private_media`
- `replay_edge`

### Step 27 — Provision devices in PlayTT

1. Keep `pnpm dev` running.
2. In operator/admin UI (or API), register:
   - One **venue_edge** device for the venue
   - One **camera** device per table (or config on edge assignment)
3. Assign **venue_edge** to the venue / resource.
4. Assign **replay_primary** camera to Table 01 channel.

Store RTSP URL in assignment **config** (server-side only):

```json
{
  "camera": {
    "id": "table-01-primary",
    "label": "Table 01 overhead",
    "rtspUrl": "rtsp://playtt_edge:PASSWORD@NVR_IP/live/1/1/avm"
  },
  "nvr": {
    "ip": "NVR_IP",
    "channel": 1,
    "stream": 1,
    "playbackTimeSuffix": "z"
  }
}
```

Never commit passwords to git.

### Step 28 — Run VenueEdge on the venue PC

```powershell
cd services\venue-edge
pnpm install

$env:VENUE_EDGE_MODE="buffer"
$env:VENUE_EDGE_CLOUD_BASE_URL="http://localhost:3000"
$env:RTSP_URL="rtsp://playtt_edge:PASSWORD@NVR_IP/live/1/1/avm"
pnpm start
```

For staging NVR fallback only (not production until pilot signed off):

```powershell
$env:VENUE_EDGE_ALLOW_VIGI_ADAPTER="true"
```

### Step 29 — Request a replay from the app

1. Start an active booking session on Table 01.
2. Call `POST /api/v1/sessions/{sessionId}/replay-requests` with idempotency key, or use legacy `POST /api/replays/request`.
3. Watch VenueEdge logs and NVR — edge should capture from buffer; if buffer fails, NVR fallback runs (when enabled).

---

## Pilot sign-off sheet

Fill this when done:

```markdown
## VIGI pilot sign-off

Venue: _______________
Date: _______________
Technician: _______________

Hardware
- NVR model: _______________
- Firmware: _______________
- NVR IP: _______________
- RTSP port: _______________
- Channels: CH1 = ______, CH2 = ______, ...

Streaming
- Storage stream: main / sub → RTSP stream # ___
- Live RTSP tested (VLC): PASS / FAIL
- Playback RTSP tested (VLC): PASS / FAIL
- Codec: h264 / h265 / other
- Playback time mode: z (UTC) / l (local)

Clock
- Timezone: _______________
- NTP: on / off
- Wave test skew: ___ sec

Security
- Dedicated RTSP user: _______________
- Password rotated tested: PASS / FAIL
- NVR not reachable from guest WAN/Wi‑Fi: PASS / FAIL

Automation
- pnpm probe:vigi: PASS / FAIL
- pilot-playback-clip.mp4 correct: PASS / FAIL

PlayTT (optional)
- Edge buffer capture: PASS / FAIL / NOT RUN
- NVR fallback: PASS / FAIL / NOT RUN

Signed: _______________
```

---

## Quick troubleshooting

| Problem | Likely cause |
| --- | --- |
| VLC live works, playback fails | Wrong `starttime`/`endtime`, wrong `z` vs `l`, or wrong stream # |
| `401 Unauthorized` | Bad RTSP user/password |
| `Connection refused` | RTSP disabled or wrong port |
| Black playback clip | Channel has no recording for that time range |
| Clip is H.265 | Set substream to H.264 in camera channel settings if possible |
| PlayTT replay queued forever | `replay_edge` flag off, no venue_edge assigned, or edge offline |

---

## Next step after sign-off

1. Mark checklist in [replay-edge.md](../platform/replay-edge.md).
2. Implement real logic in `VigiNvrPlaybackAdapter` using your confirmed URL format.
3. Run two-table isolation test (channel 1 ≠ channel 2).
4. Schedule ten-table capacity test when more tables are wired.
