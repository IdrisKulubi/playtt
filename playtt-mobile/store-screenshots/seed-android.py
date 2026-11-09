"""Builds the Google Play phone deck (1080x1920) from the same slides/copy as the iPhone deck."""
import json
P = "editor/app-store-screenshots.json"
st = json.load(open(P, encoding="utf-8"))
src = st["slidesByDevice"]["iphone"]
deck = []
for i, s in enumerate(src):
    d = {"id": f"android_{i+1}", "layout": "hero" if i % 2 == 0 else "device-bottom",
         "label": {"en": ""}, "headline": s["headline"],
         "screenshot": f"/screenshots/android/phone/{{locale}}/{i+1:02d}.png"}
    W = 700; H = round(W * 19.5 / 9)       # Android frame is 9:19.5
    y = 430
    d["transforms"] = {
        "caption": {"x": 40, "y": 110, "width": 1000, "height": 300, "align": "center"},
        "device": {"x": (1080 - W) // 2, "y": y, "width": W, "height": H, "rotation": 0, "zIndex": 3},
    }
    deck.append(d)
deck[0]["imageElements"] = [{"id": "backdrop", "src": "/art/backdrop-android.png", "fit": "cover",
    "transform": {"x": 0, "y": 0, "width": 7560, "height": 1920, "rotation": 0, "zIndex": 0}}]
st["slidesByDevice"]["android"] = deck
st["device"] = "android"
json.dump(st, open(P, "w", encoding="utf-8"), indent=2)
print("android deck seeded:", len(deck))
