"""Minimal, Apple-style deck: one backdrop, upright phones in one consistent position, sentence-case headlines."""
import json
P = "editor/app-store-screenshots.json"
st = json.load(open(P, encoding="utf-8"))
COPY = [
    "Book a table.\nJust play.",
    "Pick your time.\nWe hold the table.",
    "Booked in\na few taps.",
    "Game day,\nall in one place.",
    "Relive your\nbest rallies.",
    "Set a goal.\nKeep showing up.",
    "See how much\nyou play.",
]
PW = 1100; PH = round(PW * 2082 / 1022)
for i, s in enumerate(st["slidesByDevice"]["iphone"]):
    s["layout"] = "hero" if i % 2 == 0 else "device-bottom"
    s["label"] = {"en": ""}
    s["headline"] = {"en": COPY[i]}
    s.pop("inverted", None); s.pop("imageElements", None); s.pop("typography", None)
    hero = i == 0
    s["transforms"] = {
        "caption": {"x": 80, "y": 170, "width": 1160, "height": 420, "align": "center"},
        "device": {"x": (1320 - PW) // 2, "y": 1080 if hero else 700, "width": PW, "height": PH, "rotation": 0, "zIndex": 3},
    }
st["slidesByDevice"]["iphone"][0]["imageElements"] = [{
    "id": "backdrop", "src": "/art/backdrop.png", "fit": "cover",
    "transform": {"x": 0, "y": 0, "width": 9240, "height": 2868, "rotation": 0, "zIndex": 0}}]
st["scene"] = {"backdrop": "solid", "span": True, "decoration": "none", "shadow": 55, "glow": 0, "tilt": 0,
               "headlineWeight": 800, "headlineScale": 0.95, "headlineCase": "as-typed", "captionAlign": "center"}
json.dump(st, open(P, "w", encoding="utf-8"), indent=2)
print("seeded minimal")
