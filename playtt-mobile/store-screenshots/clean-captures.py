"""Bakes a clean 9:41 status bar into the raw captures -> editor/public/screenshots/apple/iphone/en/NN.png"""
import pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
ORDER = ["play.jpg", "book-time.jpg", "booked.png", "play-booked.png", "replay-clip.png", "progress-goal.png", "stats.jpg"]
OUT = HERE / "editor/public/screenshots/apple/iphone/en"
ICONS = open(HERE / "build.py", encoding="utf-8").read().split('STATUS_BAR = """')[1].split('"""')[0]
CSS = """
body{margin:0;width:738px;height:1600px;position:relative;overflow:hidden;font-family:Inter,'Segoe UI',sans-serif}
img{position:absolute;inset:0;width:100%;height:100%}
.status{position:absolute;top:0;left:0;right:0;height:112px;background:BGCOLOR}
.time{position:absolute;left:86px;top:34px;width:120px;text-align:center;color:#fff;font-weight:600;font-size:36px}
.icons{position:absolute;right:62px;top:38px;display:flex;gap:14px;align-items:center;transform:scale(.78);transform-origin:right center}
"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 738, "height": 1600})
    for i, f in enumerate(ORDER, 1):
        src = HERE / "raw" / f
        r, g, bl = Image.open(src).convert("RGB").getpixel((400, 20))
        html = f"<style>{CSS.replace('BGCOLOR', f'rgb({r},{g},{bl})')}</style><img src='{src.as_uri()}'>{ICONS}"
        tmp = HERE / "_c.html"; tmp.write_text(html, encoding="utf-8")
        pg.goto(tmp.as_uri(), wait_until="networkidle")
        pg.screenshot(path=str(OUT / f"{i:02d}.png"))
        tmp.unlink()
    b.close()
print("cleaned", len(ORDER))
