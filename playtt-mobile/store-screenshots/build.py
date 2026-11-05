"""
Builds the App Store screenshots (1206 x 2622, iPhone 6.3") from raw phone captures.

    python build.py            # renders every slide into out/
    python build.py play       # renders one slide by id

Raw captures live in raw/. Edit SLIDES below to change copy, order, or crops.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
W, H = 1206, 2622          # App Store 6.3" portrait
PW, PH = 738, 1600         # raw capture size
SCALE = 1.34               # phone scale on the canvas
BEZEL = 12

# id, raw file, eyebrow, headline (use <em> for the cyan word), phone top (canvas px)
SLIDES = [
    ("01-play",     "play.jpg",          "PLAYTT",   "Book a table.<br><em>Just play.</em>",   690, SCALE),
    ("02-time",     "book-time.jpg",     "CHOOSE",   "Pick your<br><em>perfect time.</em>",    610, 1.18),
    ("03-booked",   "booked.png",        "BOOKED",   "Your table,<br><em>locked in.</em>",     690, SCALE),
    ("04-gameday",  "play-booked.png",   "GAME DAY", "Game day,<br><em>sorted.</em>",          610, 1.18),
    ("05-replays",  "replay-clip.png",   "REPLAYS",  "Relive every<br><em>rally.</em>",        690, SCALE),
    ("06-progress", "progress-goal.png", "PROGRESS", "Chase your<br><em>weekly goal.</em>",    690, SCALE),
    ("07-stats",    "stats.jpg",         "STATS",    "Know your<br><em>numbers.</em>",         690, SCALE),
]

# Where the shared glow sits across the whole 7-slide strip (global x, y), so the
# background flows from one screenshot into the next when swiped.
GLOW = [(300, 1500), (1500, 900), (2500, 1700), (3800, 1000), (4900, 1600), (6000, 900), (7200, 1500)]

STATUS_BAR = """
<div class="status">
  <span class="time">9:41</span>
  <span class="icons">
    <svg width="54" height="34" viewBox="0 0 54 34" fill="#fff"><rect x="0" y="22" width="9" height="12" rx="2.5"/><rect x="15" y="15" width="9" height="19" rx="2.5"/><rect x="30" y="8" width="9" height="26" rx="2.5"/><rect x="45" y="0" width="9" height="34" rx="2.5"/></svg>
    <svg width="48" height="34" viewBox="0 0 48 34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M4 14 C 16 3, 32 3, 44 14"/><path d="M12 22 C 19 16, 29 16, 36 22"/><circle cx="24" cy="29" r="2" fill="#fff" stroke="none"/></svg>
    <svg width="78" height="36" viewBox="0 0 78 36" fill="none"><rect x="1.5" y="1.5" width="66" height="33" rx="10" stroke="#fff" stroke-opacity=".45" stroke-width="3"/><rect x="6" y="6" width="57" height="24" rx="6.5" fill="#fff"/><path d="M71 12 v12 c3-1 4-3.500 4-6 s-1-5-4-6z" fill="#fff" fill-opacity=".5"/></svg>
  </span>
</div>
"""

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800;900&display=swap" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #07111d; }}
  body {{ font-family: 'Inter', -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif; position: relative; }}
  .bg {{ position: absolute; inset: 0;
    background:
      radial-gradient(1500px 1500px at {gx}px {gy}px, rgba(0,183,255,.34), rgba(0,183,255,0) 62%),
      radial-gradient(900px 900px at {gx2}px {gy2}px, rgba(0,183,255,.10), rgba(0,183,255,0) 70%),
      linear-gradient(180deg, #0a1a2e 0%, #07111d 55%, #050c15 100%); }}
  .grain {{ position: absolute; inset: 0; opacity: .5;
    background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size: 6px 6px;
    -webkit-mask-image: linear-gradient(180deg, #000, transparent 70%); }}
  .copy {{ position: absolute; top: 150px; left: 0; right: 0; text-align: center; }}
  .eyebrow {{ font-weight: 800; font-size: 40px; letter-spacing: .34em; color: #00b7ff; padding-left: .34em; }}
  h1 {{ margin-top: 34px; font-weight: 900; font-size: 148px; line-height: .96; letter-spacing: -.03em; word-spacing: .06em; color: #fff; }}
  h1 em {{ font-style: normal; color: #00b7ff; }}
  .brand {{ position: absolute; top: 58px; left: 0; right: 0; display: flex; justify-content: center; }}
  .brand img {{ height: 56px; opacity: .95; }}

  .phone {{ position: absolute; left: {phone_left}px; top: {top}px; width: {pw}px; height: {ph}px;
    transform: scale({scale}); transform-origin: 0 0;
    border-radius: 112px; padding: {bezel}px;
    background: linear-gradient(145deg, #5b6572 0%, #1b2026 18%, #0b0e12 50%, #1b2026 82%, #4a525d 100%);
    box-shadow: 0 0 0 2px rgba(255,255,255,.12) inset, 0 0 0 1px rgba(0,0,0,.9), 0 50px 120px rgba(0,0,0,.55); }}
  .btn {{ position: absolute; width: 6px; border-radius: 3px; background: linear-gradient(90deg,#3a414b,#14181d); }}
  .btn.l {{ left: -6px; }} .btn.r {{ right: -6px; transform: scaleX(-1); }}
  .screen {{ position: relative; width: {sw}px; height: {sh}px; border-radius: 98px; overflow: hidden; background: #07111d; }}
  .screen img.shot {{ position: absolute; inset: 0; width: 100%; height: 100%; display: block; }}
  .island {{ position: absolute; top: 24px; left: 50%; width: 224px; height: 66px; margin-left: -112px; border-radius: 40px; background: #000; z-index: 5; }}
  .status {{ position: absolute; top: 0; left: 0; right: 0; height: 112px; background: {sbg}; z-index: 4; }}
  .time {{ position: absolute; left: 86px; top: 34px; width: 120px; text-align: center; color: #fff; font-weight: 600; font-size: 36px; letter-spacing: -.01em; }}
  .icons {{ position: absolute; right: 62px; top: 38px; display: flex; gap: 14px; align-items: center; transform: scale(.78); transform-origin: right center; }}
  .sheen {{ position: absolute; inset: 0; z-index: 6; pointer-events: none; border-radius: 98px;
    background: linear-gradient(115deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 28%); }}
</style></head><body>
  <div class="bg"></div><div class="grain"></div>
  {brand}
  <div class="copy"><div class="eyebrow">{eyebrow}</div><h1>{headline}</h1></div>
  <div class="phone">
    <div class="btn l" style="top:250px;height:52px"></div>
    <div class="btn l" style="top:350px;height:104px"></div>
    <div class="btn l" style="top:480px;height:104px"></div>
    <div class="btn r" style="top:400px;height:150px"></div>
    <div class="screen">
    <img class="shot" src="{shot}">
    {status}<div class="island"></div>
  </div></div>
</body></html>"""


def build(playwright, idx, slide):
    sid, shot, eyebrow, headline, top, scale = slide
    pw, ph = PW + BEZEL * 2, PH + BEZEL * 2
    phone_left = (W - pw * scale) / 2
    gx, gy = GLOW[idx][0] - idx * W, GLOW[idx][1]
    nxt = GLOW[(idx + 1) % len(GLOW)]
    from PIL import Image
    r, g, b = Image.open(HERE / "raw" / shot).convert("RGB").getpixel((400, 20))
    html = PAGE.format(
        sbg=f"rgb({r},{g},{b})",
        W=W, H=H, gx=gx, gy=gy, gx2=nxt[0] - idx * W, gy2=nxt[1],
        phone_left=phone_left, top=top, pw=pw, ph=ph, scale=scale, bezel=BEZEL, sw=PW, sh=PH,
        eyebrow=eyebrow, headline=headline, status=STATUS_BAR,
        shot=(HERE / "raw" / shot).as_uri(),
        brand=f'<div class="brand"><img src="{(HERE / "logo-reversed.png").as_uri()}"></div>' if idx == 0 else "",
    )
    page = playwright.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    tmp = HERE / f"_{sid}.html"
    tmp.write_text(html, encoding="utf-8")
    page.goto(tmp.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    out = HERE / "out" / f"{sid}.png"
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": W, "height": H})
    page.close()
    tmp.unlink()
    print("wrote", out.name)


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    (HERE / "out").mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser
        for i, s in enumerate(SLIDES):
            if only and only not in s[0]:
                continue
            build(ctx, i, s)
        browser.close()
