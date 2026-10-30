"""Voice-over for the history film: Kokoro TTS (Apache 2.0, local) reads the captions, timed to the shots.
`python vo.py [voice]` writes assets/vo/<voice>/<id>.wav (24 kHz mono) and vo_lines.json with the measured lengths.
Lines carry a start time in film seconds; an optional 6th field "end" anchors the line's end instead."""
import json, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
B = lambda n: round(25.10 + n * 0.952, 3)

# id, time, text spoken, era ("old" = newsreel treatment, "new" = clean), speed
LINES = [
    ("v01", 0.25,  "It started as a parlour game.", "old", 1.1),
    ("v02", B(-24) + 0.2, "By nineteen oh two, it was a craze.", "old", 1.1),
    ("v03", B(-22) + 0.75, "Then, it became a sport.", "old", 1.0),
    ("v04", B(-18) + 0.3, "The halls filled up.", "old", 1.0),
    ("v05", B(-12) + 0.2, "Crowds came to watch.", "old", 1.0),
    ("v06", B(-10) + 0.2, "It even helped bring nations together.", "old", 1.0),
    ("v07", B(-6) + 0.05, "Today, the whole world plays.", "old", 1.1),
    ("v08", 21.45, "But for most of us, finding a table is still hard.", "old", 1.12),
    ("v09", 24.55, "So we built...", "new", 1.05),
    ("v10", B(0) + 0.65, "Play T T.", "new", 0.95),
    ("v11", B(2) + 0.1,  "Book a table from your phone.", "new", 1.1),
    ("v12", B(4) + 0.25,  "Show up, and play.", "new", 1.0),
    ("v13", B(6) + 0.2,  "Find people to play with.", "new", 1.0),
    ("v14", B(8) + 0.2,  "Everyone is welcome.", "new", 1.0),
    ("v15", B(10) + 0.2, "Build your community.", "new", 1.0),
    ("v16", B(12) + 0.2, "Table tennis, for everyone.", "new", 0.95),
    ("v17", B(14) + 0.7, "Play T T. Coming soon, to Nairobi.", "new", 0.95),
]


def trim(x, sr, thr=0.01, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a, b = max(0, idx[0] - int(pad * sr)), min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


if __name__ == "__main__":
    voice = sys.argv[1] if len(sys.argv) > 1 else "bm_george"
    k = Kokoro(str(HERE / "assets/tts/kokoro-v1.0.onnx"), str(HERE / "assets/tts/voices-v1.0.bin"))
    out = HERE / "assets/vo" / voice; out.mkdir(parents=True, exist_ok=True)
    meta = []
    for row in LINES:
        lid, t, text, era, speed = row[:5]
        anchor = row[5] if len(row) > 5 else "start"
        x, sr = k.create(text, voice=voice, speed=speed, lang="en-gb" if voice.startswith("b") else "en-us")
        x = trim(np.asarray(x, np.float32), sr)
        sf.write(out / f"{lid}.wav", x, sr)
        d = len(x) / sr
        start = t - d if anchor == "end" else t
        meta.append(dict(id=lid, start=round(start, 3), dur=round(d, 3), text=text, era=era))
        print(f"{lid} {start:6.2f}-{start + d:6.2f}  {d:4.2f}s  {text}")
    (out / "vo_lines.json").write_text(json.dumps(meta, indent=1), encoding="utf8")
