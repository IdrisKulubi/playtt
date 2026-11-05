"""Generates the floating UI cards + ping-pong rally trail used as image overlays in the editor."""
import math, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
ART = HERE / "editor/public/art"
PAD = 80
CHIPS = {   # name: (raw file, native crop box)
    "check": ("booked.png",       (30, 405, 708, 845)),
    "entry": ("play-booked.png",  (30, 293, 708, 886)),
    "clip":  ("replay-clip.png",  (30, 712, 708, 1092)),
    "ring":  ("progress-goal.png",(30, 293, 708, 720)),
    "stats": ("stats.jpg",        (30, 1010, 708, 1380)),
}

def chip_html(f, box):
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0
    return f"""<body style="margin:0;background:transparent"><div style="padding:{PAD}px;width:{w}px">
<div style="width:{w}px;height:{h}px;border-radius:40px;overflow:hidden;position:relative;
 box-shadow:0 0 0 2px rgba(255,255,255,.16),0 40px 70px rgba(0,0,0,.6),0 0 60px rgba(0,183,255,.28)">
<img src="{(HERE/'raw'/f).as_uri()}" style="position:absolute;left:-{x0}px;top:-{y0}px;width:738px;height:1600px">
</div></div></body>"""

# ---- rally trail -------------------------------------------------------------
N, CW, CH = 7, 1320, 2868
BOUNCE_Y = 2430
APEX = [650, 560, 720, 600, 700, 580, 660]       # apex height of each arc (one per slide)

def bez(x0, apex, t):
    cy = (4 * apex - 2 * BOUNCE_Y) / 2          # control point so the apex lands on `apex`
    x = (1-t)**2 * x0 + 2*(1-t)*t*(x0 + CW/2) + t*t*(x0 + CW)
    y = (1-t)**2 * BOUNCE_Y + 2*(1-t)*t*cy + t*t*BOUNCE_Y
    return x, y

def trail_svg():
    d = []
    for k in range(N):
        x0 = k * CW
        cy = (4 * APEX[k] - 2 * BOUNCE_Y) / 2
        d.append(f'<path d="M{x0} {BOUNCE_Y} Q{x0+CW/2} {cy} {x0+CW} {BOUNCE_Y}" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-dasharray="1 30" opacity="1"/>')
    rings = "".join(f'<ellipse cx="{k*CW}" cy="{BOUNCE_Y+8}" rx="{70 if k else 0}" ry="16" fill="none" stroke="#00b7ff" stroke-width="5" opacity=".7"/>'
                    f'<ellipse cx="{k*CW}" cy="{BOUNCE_Y+8}" rx="{120 if k else 0}" ry="28" fill="none" stroke="#00b7ff" stroke-width="3" opacity=".35"/>' for k in range(1, N))
    def ball(cx, cy, r, op=1, glow=False):
        g = ' filter="url(#glow)"' if glow else ""
        return (f'<g opacity="{op}"{g}><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#ball)"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#9fe3ff" stroke-width="3" opacity=".5"/></g>')
    balls = []
    # hero ball + motion ghosts, mid-air in the gap after seam 2 (visible between two phones)
    for i, (t, r, op) in enumerate([(0.012, 20, .12), (0.030, 28, .22), (0.048, 36, .36), (0.066, 44, .55), (0.084, 52, .78)]):
        x, y = bez(3 * CW, APEX[3], t); balls.append(ball(x, y, r, op))
    x, y = bez(3 * CW, APEX[3], 0.102); balls.append(ball(x, y, 64, 1, True))
    # second ball in the gap before seam 5, coming down
    for (t, r, op) in [(0.88, 26, .15), (0.905, 34, .3), (0.93, 42, .55)]:
        x, y = bez(4 * CW, APEX[4], t); balls.append(ball(x, y, r, op))
    x, y = bez(4 * CW, APEX[4], 0.955); balls.append(ball(x, y, 56, 1, True))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{N*CW}" height="{CH}" viewBox="0 0 {N*CW} {CH}">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#00b7ff"/><stop offset="1" stop-color="#7fdcff"/></linearGradient>
<radialGradient id="ball" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#dff4ff"/><stop offset="1" stop-color="#6cc9f5"/></radialGradient>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="20" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
{''.join(d)}{rings}{''.join(balls)}</svg>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 900, "height": 700}, device_scale_factor=1)
    for name, (f, box) in CHIPS.items():
        tmp = HERE / "_chip.html"; tmp.write_text(chip_html(f, box), encoding="utf-8")
        pg.goto(tmp.as_uri(), wait_until="networkidle")
        pg.locator("body > div").screenshot(path=str(ART / f"{name}.png"), omit_background=True)
        tmp.unlink()
    pg2 = b.new_page(viewport={"width": N*CW//2, "height": CH//2})
    tmp = HERE / "_trail.html"
    tmp.write_text(f'<body style="margin:0;background:transparent"><div style="zoom:.5">{trail_svg()}</div></body>', encoding="utf-8")
    pg2.goto(tmp.as_uri(), wait_until="networkidle")
    pg2.screenshot(path=str(ART / "rally.png"), omit_background=True)
    tmp.unlink(); b.close()
print("art done")
