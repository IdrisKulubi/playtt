"""App Store creative assets: product page header (3840x1646) and search results (3840x2560).
Key art stays inside Apple's safe areas (measured from Apple's templates)."""
import pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
OUT = HERE / "creatives"
ICON = (OUT / "_icon.png").as_uri()
FRAME = (HERE / "editor/public/frames/iphone-portrait.png").as_uri()
SHOT = (HERE / "editor/public/screenshots/apple/iphone/en/04.png").as_uri()
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=block" rel="stylesheet">'
BASE = "*{margin:0;padding:0;box-sizing:border-box} body{background:#07111d;font-family:Inter,'Segoe UI',sans-serif;overflow:hidden}"

def neon(w, h, x0, y0, x1, y1, r):
    """The venue's neon roofline: top edge + both sides, open at the bottom, with a floor reflection."""
    path = f"M{x0} {y1} L{x0} {y0+r} Q{x0} {y0} {x0+r} {y0} L{x1-r} {y0} Q{x1} {y0} {x1} {y0+r} L{x1} {y1}"
    return f"""<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position:absolute;inset:0">
<defs><filter id="b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
<filter id="b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="m"><rect width="{w}" height="{h}" fill="url(#fade)"/></mask>
<radialGradient id="floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#00b7ff" stop-opacity=".35"/><stop offset="1" stop-color="#00b7ff" stop-opacity="0"/></radialGradient></defs>
<g mask="url(#m)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="{path}" stroke="#00b7ff" stroke-width="26" opacity=".55" filter="url(#b1)"/>
<path d="{path}" stroke="#00b7ff" stroke-width="12" opacity=".9" filter="url(#b2)"/>
<path d="{path}" stroke="#bfeeff" stroke-width="5"/></g>
<ellipse cx="{(x0+x1)/2}" cy="{y1+10}" rx="{(x1-x0)*.55}" ry="90" fill="url(#floor)"/></svg>"""

def header():
    W, H = 3840, 1646            # safe area x 1097-2743, y 493-1154
    return W, H, f"""{FONTS}<style>{BASE}
.bg{{position:absolute;inset:0;background:radial-gradient(1800px 900px at 50% 46%,#0e2236 0%,#0a1828 45%,#07111d 80%)}}
.lock{{position:absolute;left:0;right:0;top:600px;display:flex;justify-content:center;align-items:center;gap:56px}}
.lock img{{height:300px}}
.word{{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:300px;letter-spacing:-.02em;color:#fff;line-height:1}}
.tag{{position:absolute;left:0;right:0;top:1010px;text-align:center;font-weight:500;font-size:84px;color:#9fb4cc;letter-spacing:-.005em}}
</style><body style="width:{W}px;height:{H}px;position:relative"><div class="bg"></div>
{neon(W, H, 1020, 420, 2820, 1330, 70)}
<div class="lock"><img src="{ICON}"><div class="word">PlayTT</div></div>
<div class="tag">Book a table. Just play.</div></body>"""

def search():
    W, H = 3840, 2560            # safe area x 836-3004, y 765-1795
    PW = 900; PH = round(PW * 3000 / 1470)
    sx, sy = 75 / 1470, 66 / 3000; sw, sh = 1320 / 1470, 2868 / 3000
    return W, H, f"""{FONTS}<style>{BASE}
.bg{{position:absolute;inset:0;background:radial-gradient(2200px 1500px at 72% 70%,#0f2a42 0%,#0a1828 45%,#07111d 80%)}}
h1{{position:absolute;left:880px;top:960px;font-weight:800;font-size:196px;line-height:1.02;letter-spacing:-.035em;color:#fff}}
h1 span{{color:#00b7ff}}
p{{position:absolute;left:886px;top:1420px;font-weight:500;font-size:80px;line-height:1.3;color:#9fb4cc;letter-spacing:-.005em}}
.phone{{position:absolute;left:2080px;top:740px;width:{PW}px;height:{PH}px;filter:drop-shadow(0 60px 120px rgba(0,0,0,.6))}}
.phone .scr{{position:absolute;left:{sx*100}%;top:{sy*100}%;width:{sw*100}%;height:{sh*100}%;border-radius:115px;overflow:hidden;background:#07111d}}
.phone .scr img,.phone>img{{position:absolute;inset:0;width:100%;height:100%}}
</style><body style="width:{W}px;height:{H}px;position:relative"><div class="bg"></div>
<h1>Book a table.<br><span>Just play.</span></h1>
<p>Pick a time, walk in<br>with your entry code.</p>
<div class="phone"><div class="scr"><img src="{SHOT}"></div><img src="{FRAME}"></div></body>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, fn in [("header-3840x1646", header), ("search-3840x2560", search)]:
        W, H, html = fn()
        pg = b.new_page(viewport={"width": W, "height": H})
        tmp = HERE / "_cr.html"; tmp.write_text(html, encoding="utf-8")
        pg.goto(tmp.as_uri(), wait_until="networkidle"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / f"{name}.png"))
        pg.close(); tmp.unlink()
    b.close()
print("creatives done")
