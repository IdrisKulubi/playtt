"""Applies the cross-screen design (phone tilt, rally trail, seam-straddling UI cards) to the editor project."""
import json
from PIL import Image
P = "editor/app-store-screenshots.json"
st = json.load(open(P, encoding="utf-8"))
slides = st["slidesByDevice"]["iphone"]
S = 1.0; PAD = 80
rot = [-4, 4, -4, 4, -4, 4, -4]
for i, s in enumerate(slides):
    s["transforms"]["device"]["rotation"] = rot[i]
    s["transforms"]["device"]["zIndex"] = 3
    s.pop("imageElements", None)

def chip(name, slide_idx, y_vis, rotation, overhang=0.45):
    w, h = Image.open(f"editor/public/art/{name}.png").size
    vis_w = (w - 2 * PAD) * S
    x = 1320 - (1 - overhang) * vis_w - PAD * S
    slides[slide_idx].setdefault("imageElements", []).append({
        "id": f"chip_{name}", "src": f"/art/{name}.png", "fit": "contain",
        "transform": {"x": round(x), "y": round(y_vis - PAD * S), "width": round(w * S), "height": round(h * S),
                      "rotation": rotation, "zIndex": 6}})

slides[0].setdefault("imageElements", []).append({
    "id": "rally", "src": "/art/rally.png", "fit": "contain",
    "transform": {"x": 0, "y": 0, "width": 9240, "height": 2868, "rotation": 0, "zIndex": 2}})

chip("check", 0, 2060, -5)
chip("entry", 1, 2080, 4)
chip("clip",  2, 2300, -4)
chip("ring",  3, 1700, 5)
chip("stats", 4, 2330, -3)
json.dump(st, open(P, "w", encoding="utf-8"), indent=2)
print("seeded")
