"""PlayTT history film soundtrack (45 s): Mixkit #543 "I Won't Surrender" from song 0.0, so its entrance (25.10 s)
lands on the PlayTT logo. A faint projector hiss sits under the archive half; one low hit doubles the entrance.
Voice-over (vo.py, `python audio.py [voice]`): archive lines go through an old newsreel speaker (band-limited, saturated,
wow and crackle), PlayTT lines stay clean and warm. Music ducks under the voice. Two-pass loudnorm to -14 LUFS."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
import imageio_ffmpeg

HERE = Path(__file__).parent
FF, SR, T = imageio_ffmpeg.get_ffmpeg_exe(), 48000, 45.0
N = int(round(T * SR))


def load(p):
    raw = subprocess.run([FF, "-v", "quiet", "-i", str(p), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


rng = np.random.default_rng(11)
t = np.arange(N) / SR
mix = load(HERE / "assets/music-543.mp3")[:N].copy()
# projector hiss: band-limited noise with a 24 fps flutter, fading out into the entrance
hiss = np.convolve(rng.standard_normal(N), np.ones(6) / 6, "same") * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * t) ** 2)
hiss *= np.clip(t / 0.8, 0, 1) * np.clip((24.6 - t) / 1.5, 0, 1) * 0.012
mix += hiss[:, None]
# low hit on the entrance
n = int(0.9 * SR); tt = np.arange(n) / SR
hit = np.sin(2 * np.pi * np.cumsum(np.linspace(110, 38, n)) / SR) * np.exp(-tt / 0.25) * np.minimum(1, tt / 0.002) * 0.3
i0 = int(25.10 * SR) - int(np.abs(hit).argmax()); mix[i0:i0 + n] += hit[:, None]
f0 = int(43.2 * SR); mix[f0:] *= np.linspace(1, 0, N - f0)[:, None] ** 1.5

# voice-over
OLD = ("highpass=f=330,highpass=f=330,lowpass=f=3300,lowpass=f=3300,equalizer=f=1700:t=q:w=1.2:g=6,"
       "acompressor=threshold=0.08:ratio=8:attack=3:release=60:makeup=2,asoftclip=type=tanh,"
       "vibrato=f=0.9:d=0.025,aecho=0.8:0.5:22:0.18,volume=1.6")
NEW = "highpass=f=75,equalizer=f=180:t=q:w=1:g=2,equalizer=f=4200:t=q:w=1.5:g=2.5,acompressor=threshold=0.12:ratio=3:attack=8:release=120:makeup=1.6,aecho=0.85:0.4:45:0.07"
voice = sys.argv[1] if len(sys.argv) > 1 else "bm_george"
vdir = HERE / "assets/vo" / voice
vo = np.zeros(N, np.float32)
for ln in json.loads((vdir / "vo_lines.json").read_text(encoding="utf8")):
    raw = subprocess.run([FF, "-v", "quiet", "-i", str(vdir / f"{ln['id']}.wav"), "-af", OLD if ln["era"] == "old" else NEW,
                          "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    x /= max(1e-6, np.sqrt(np.mean(x ** 2))) / 0.11          # same loudness for every line
    if ln["era"] == "old":                                      # crackle: sparse clicks while the old speaker talks
        clicks = (rng.random(len(x)) < 18 / SR) * rng.choice([-1, 1], len(x)) * rng.uniform(0.05, 0.25, len(x))
        x += np.convolve(clicks, np.exp(-np.arange(24) / 4), "same").astype(np.float32)
        x += (np.convolve(rng.standard_normal(len(x)), np.ones(4) / 4, "same") * 0.006).astype(np.float32)
    i = int(ln["start"] * SR); x = x[:N - i]; vo[i:i + len(x)] += x
# duck the music ~8 dB under the voice (60 ms attack, 350 ms release)
env = np.abs(vo) > 0.01
g = np.ones(N, np.float32); cur = 1.0; a, r = 1 - np.exp(-1 / (0.06 * SR)), 1 - np.exp(-1 / (0.35 * SR))
w = int(0.25 * SR); cs = np.concatenate([[0], np.cumsum(env)]); hold = (cs[np.minimum(np.arange(N) + w // 2, N)] - cs[np.maximum(np.arange(N) - w // 2, 0)]) > 0
target = np.where(hold, 0.4, 1.0)
for k in range(0, N, 48):                                       # 1 ms control rate
    cur += (target[k] - cur) * (a if target[k] < cur else r) * 48
    g[k:k + 48] = cur
mix *= g[:, None]
mix += vo[:, None]
rawp = HERE / "out/raw.wav"; rawp.parent.mkdir(exist_ok=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(rawp)], input=mix.astype(np.float32).tobytes(), check=True)
m = subprocess.run([FF, "-hide_banner", "-i", str(rawp), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.89:level=false")
subprocess.run([FF, "-v", "error", "-y", "-i", str(rawp), "-af", af, "-ar", str(SR), str(HERE / "out/audio.wav")], check=True)
print("audio ->", HERE / "out/audio.wav")
