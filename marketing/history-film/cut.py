"""Shot list for the PlayTT history film, and the frame cutter.
Music: Mixkit #543 "I Won't Surrender" from song 0.0, ~63 BPM (beat 0.952 s), pickup hit 24.64 s, full entrance 25.10 s.
Cuts sit on the beat grid 25.10 + n * 0.952. `python cut.py` writes shots.json and extracts every video shot to
frames/<id>/f_XXXX.jpg at 30 fps, 1920x1080 cover crop (archive clips graded to black and white)."""
import json, shutil, subprocess
from pathlib import Path
import imageio_ffmpeg

HERE = Path(__file__).parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
B = lambda n: round(25.10 + n * 0.952, 3)   # beat n (negative = before the entrance)

# id, start, end, kind, source, source in-point (s) or fit, caption, label
SHOTS = [
    ("s01", 0.00,   B(-24), "img", "I00", "cover",   "It started as a parlour game.", "Ping-Pong cartoon · 1902"),
    ("s02", B(-24), B(-22), "img", "I08", "contain", "By 1902, it was a craze.", "Political Ping Pong · 1902"),
    ("s03", B(-22), B(-20), "img", "I05", "cover",   "Then it became a sport.", "Table tennis team · c. 1925"),
    ("s04", B(-20), B(-18), "img", "I04", "cover",   None, "Mária Mednyánszky · world champion · 1928"),
    ("s05", B(-18), B(-16), "vid", "C04.webm", 38.0, "The halls filled up.", "International match · 1934"),
    ("s06", B(-16), B(-14), "vid", "C06.webm", 2.9,  None, "Amsterdam · 1935"),
    ("s07", B(-14), B(-12), "vid", "C06.webm", 40.0, None, None),
    ("s08", B(-12), B(-10), "vid", "C08.webm", 9.0,  "Crowds came to watch.", "Dutch Open · 1949"),
    ("s09", B(-10), B(-8), "img", "I06", "cover",   "It even helped bring nations together.", "Beijing · 1972"),
    ("s10", B(-8), B(-6),  "vid", "C12.ogv", 37.0,  None, "Netherlands v China · 1977"),
    ("s11", B(-6),  B(-4),  "img", "I09", "cover",   "Today, the whole world plays.", "European Championships · 2022"),
    ("s12", B(-4),  B(-3),  "img", "I10", "cover",   None, "African Games, Accra · 2024"),
    ("s13", B(-3),  24.64,  "vid", "C10.webm", 5.0,  "But for most of us, finding a table is still hard.", None),
    ("s14", 24.64,  B(0),   "card", "so",  None,     None, None),
    ("s15", B(0),   B(2),   "card", "logo", None,    None, None),
    ("s16", B(2),   B(4),   "card", "book", None,    "Book a table from your phone.", None),
    ("s17", B(4),   B(6),   "vid", "px29323695.mp4", 0.5, "Show up and play.", None),
    ("s18", B(6),   B(8),   "vid", "px992596.mp4", 2.0,   "Find people to play with.", None),
    ("s19", B(8),   B(10),  "vid", "mk49021.mp4", 2.0,    "Everyone is welcome.", None),
    ("s20", B(10),  B(12),  "vid", "px13373931.mp4", 5.0, "Build your community.", None),
    ("s21", B(12),  B(14),  "img", "I14", "cover",   "Table tennis, for everyone.", None),
    ("s22", B(14),  45.0,   "card", "end", None,     None, None),
]
ARCHIVE = {"C04.webm", "C06.webm", "C08.webm", "C12.ogv"}

if __name__ == "__main__":
    out = []
    for sid, a, b, kind, src, arg, cap, lab in SHOTS:
        s = dict(id=sid, t0=a, t1=b, kind=kind, src=src, cap=cap, label=lab)
        if kind == "img": s["fit"] = arg
        if kind == "vid":
            d = HERE / "frames" / sid; shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
            grade = ",format=gray,eq=contrast=1.12:brightness=0.01" if src in ARCHIVE else ",eq=saturation=1.05"
            subprocess.run([FF, "-v", "error", "-y", "-ss", str(arg), "-i", str(HERE / "assets/raw" / src), "-t", str(b - a + 0.3),
                            "-vf", f"fps=30,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080{grade}",
                            "-q:v", "3", str(d / "f_%04d.jpg")], check=True)
            s["n"] = len(list(d.glob("*.jpg")))
        out.append(s)
        print(sid, kind, src, round(b - a, 2), s.get("n", ""))
    (HERE / "shots.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
