"""PlayTT cartoon story soundtrack (22 s): Mixkit track 129 (120 BPM) started at 0.10 s so its drop (song 16.10 s)
lands on the around-the-net shot at 16.0 s. SFX are synthesized in code and placed by their measured peak. Two-pass loudnorm -14 LUFS."""
import json, subprocess
from pathlib import Path
import numpy as np
import imageio_ffmpeg

HERE = Path(__file__).parent
FF, SR, T = imageio_ffmpeg.get_ffmpeg_exe(), 48000, 22.0
N = int(round(T * SR)); DROP_SONG, DROP_FILM = 16.10, 16.0
START = DROP_SONG - DROP_FILM


def load(p):
    raw = subprocess.run([FF, "-v", "quiet", "-i", str(p), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def env(n, a=0.002, d=0.05):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def tone(f0, f1, dur, d):
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR
    return np.sin(ph) * env(n, 0.001, d)


rng = np.random.default_rng(7)
def noise(dur):
    return rng.standard_normal(int(dur * SR))


def ball():   # ping-pong ball: bright short knock
    return 0.7 * tone(3200, 2600, 0.06, 0.012) + 0.3 * noise(0.06) * env(int(0.06 * SR), 0.0005, 0.004)
def click():
    return 0.6 * tone(1800, 1200, 0.04, 0.008) + 0.25 * noise(0.04) * env(int(0.04 * SR), 0.0005, 0.003)
def tick():
    return tone(2400, 2200, 0.03, 0.006)
def pop():
    return tone(500, 1100, 0.09, 0.03)
def success():
    return 0.6 * tone(880, 880, 0.25, 0.1) + 0.5 * np.pad(tone(1320, 1320, 0.25, 0.12), (int(0.07 * SR), 0))[:int(0.25 * SR)]
def nope():   # soft "nah" buzz for the dead ends
    return tone(260, 190, 0.16, 0.06)
def beep():   # keypad
    return tone(1560, 1560, 0.07, 0.03)
def whoosh(dur=0.35):
    n = int(dur * SR); x = noise(dur)
    x = np.convolve(x, np.ones(24) / 24, "same")                    # soften the hiss
    return x * np.sin(np.pi * np.arange(n) / n) ** 2
def impact():
    return 0.9 * tone(140, 45, 0.6, 0.18) + 0.25 * noise(0.6) * env(int(0.6 * SR), 0.001, 0.03)


mix = load(HERE / "assets/music-129.mp3")[int(START * SR):][:N].copy() * 0.8
fi = int(0.05 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
EV = [(0.12, pop, .12), (0.45, pop, .1), (0.95, pop, .1), (1.45, pop, .1), (0.72, nope, .12), (1.22, nope, .12), (1.72, nope, .12), (2.15, nope, .1)]
EV += [(3.0, whoosh, .07), (3.22, pop, .12), (3.75, click, .22), (4.25, click, .22), (4.6, success, .14), (4.85, pop, .12), (5.0, tick, .08), (5.08, tick, .08)]
EV += [(6.0, whoosh, .07), (6.15, pop, .12), (6.3, pop, .12), (7.42, pop, .12), (7.5, pop, .1), (7.95, pop, .14)]
EV += [(8.5, whoosh, .07), (8.62, pop, .12), (9.42, success, .1)] + [(p, beep, .12) for p in (10.0, 10.15, 10.3, 10.45)] + [(10.6, success, .14), (10.85, whoosh, .05)]
EV += [(11.5, whoosh, .07), (11.62, pop, .12)] + [(11.75 + 0.25 * i, ball, .2 if i % 2 == 0 else .14) for i in range(6)] + [(13.5, click, .25), (13.56, pop, .14)]
EV += [(14.5, whoosh, .07), (14.75, ball, .22), (16.0, impact, .35), (16.0, ball, .2), (16.42, whoosh, .06), (16.62, pop, .12)]
EV += [(17.15, click, .22), (17.35, pop, .12)] + [(17.45 + 0.09 * i, tick, .04) for i in range(12)] + [(17.9, pop, .14)]
EV += [(19.0, whoosh, .07), (19.08, pop, .1)]
for t, fn, gain in EV:
    s = fn(); s = s / (np.abs(s).max() + 1e-9) * gain
    s = np.stack([s, s], 1)
    i0 = int(round(t * SR)) - int(np.abs(s[:, 0]).argmax())            # land the measured peak on t
    lo, hi = max(0, i0), min(N, i0 + len(s))
    if hi > lo: mix[lo:hi] += s[lo - i0:hi - i0]
f0 = int(21.0 * SR); mix[f0:] *= np.linspace(1, 0, N - f0)[:, None] ** 1.5
rawp = HERE / "out/raw.wav"; rawp.parent.mkdir(exist_ok=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(rawp)], input=mix.astype(np.float32).tobytes(), check=True)
m = subprocess.run([FF, "-hide_banner", "-i", str(rawp), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
subprocess.run([FF, "-v", "error", "-y", "-i", str(rawp), "-af", af, "-ar", str(SR), str(HERE / "out/audio.wav")], check=True)
print("audio ->", HERE / "out/audio.wav")
