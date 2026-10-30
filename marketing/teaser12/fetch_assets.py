"""Downloads the free font, music and SFX used by the teaser into assets/ (not committed)."""
import sys, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / "assets"
A.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
FILES = {
    "space-grotesk-500.woff2": "https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk@5.1.0/files/space-grotesk-latin-500-normal.woff2",
    "space-grotesk-700.woff2": "https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk@5.1.0/files/space-grotesk-latin-700-normal.woff2",
}
for i in sys.argv[1:]:  # extra Mixkit music ids
    FILES[f"music-{i}.mp3"] = f"https://assets.mixkit.co/music/{i}/{i}.mp3"
for name, url in FILES.items():
    p = A / name
    if p.exists(): continue
    p.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
    print(name, p.stat().st_size)
