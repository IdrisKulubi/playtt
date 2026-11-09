"""One continuous backdrop for the whole 7-slide strip: navy, a soft cyan horizon glow,
and the venue photo behind slide 1's headline, fading out into slide 2."""
import pathlib, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
# usage: python make-backdrop.py            -> iPhone canvas (1320x2868)
#        python make-backdrop.py android    -> Google Play phone canvas (1080x1920)
ANDROID = len(sys.argv) > 1 and sys.argv[1] == "android"
N, CW, CH = (7, 1080, 1920) if ANDROID else (7, 1320, 2868)
PHOTO_W = round(2300 * CW / 1320)
PHOTO_H = round(PHOTO_W * 1024 / 1536)
venue = (HERE / "editor/public/art/venue.png").as_uri()
html = f"""<body style="margin:0;background:#07111d">
<div style="position:relative;width:{N*CW}px;height:{CH}px;overflow:hidden;background:#07111d">
  <!-- horizon glow along the bottom, gently undulating so each slide sits in its own pool of light -->
  {''.join(f'<div style="position:absolute;left:{k*CW - 260}px;top:{CH-900*CH//2868}px;width:{CW+520}px;height:{1400*CH//2868}px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,183,255,.30),rgba(0,183,255,.10) 55%,rgba(0,183,255,0) 100%);filter:blur(40px)"></div>' for k in range(N))}
  <!-- venue photo: slide 1 top, fading right into slide 2 and down into the navy -->
  <div style="position:absolute;left:-120px;top:0;width:{PHOTO_W}px;height:{PHOTO_H}px;
       background:url('{venue}') center/cover;
       -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 66%,transparent 100%),linear-gradient(180deg,#000 0%,#000 55%,transparent 100%);
       -webkit-mask-composite:source-in;mask-composite:intersect"></div>
  <!-- scrim so the headline stays legible over the photo -->
  <div style="position:absolute;left:0;top:0;width:{CW+800}px;height:{900*CH//2868}px;
       background:linear-gradient(180deg,rgba(7,17,29,.78) 0%,rgba(7,17,29,.35) 60%,rgba(7,17,29,0) 100%);
       -webkit-mask-image:linear-gradient(90deg,#000 70%,transparent 100%)"></div>
</div></body>"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": N*CW//2, "height": CH//2})
    tmp = HERE / "_bg.html"; tmp.write_text(f'<div style="zoom:.5">{html}</div>', encoding="utf-8")
    pg.goto(tmp.as_uri(), wait_until="networkidle")
    pg.screenshot(path=str(HERE / ("editor/public/art/backdrop-android.png" if ANDROID else "editor/public/art/backdrop.png")))
    tmp.unlink(); b.close()
print("backdrop done")
