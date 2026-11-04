"""Builds the iOS app icon set from assets/images/mark.png-style artwork.

Source: appstore.png (navy + cyan table on white). Output, all 1024x1024 and fully opaque
(Apple rejects App Store icons with transparency):
  icon-light.png   the original on white
  icon-dark.png    navy turned white, on the app's dark background
  icon-tinted.png  grayscale on black, which iOS tints with the user's chosen colour

    python scripts/make-app-icons.py
"""
from pathlib import Path

from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "assets" / "images"
SOURCE = IMAGES / "icon-source.png"

DARK_BG = (7, 17, 29)  # matches the splash screen background
WHITE = (255, 255, 255)


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    flat = Image.new("RGB", src.size, WHITE)
    flat.paste(src, mask=src.split()[3])
    flat.save(IMAGES / "icon-light.png")

    px = flat.load()
    w, h = flat.size
    dark = Image.new("RGB", (w, h), DARK_BG)
    tinted = Image.new("RGB", (w, h), (0, 0, 0))
    dpx, tpx = dark.load(), tinted.load()

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            alpha = (255 - r) / 255  # both inks lose red as they get stronger
            if alpha < 0.01:
                continue
            pure_g = (g - 255 * (1 - alpha)) / alpha
            is_cyan = pure_g > 110
            ink_dark = (0, 182, 255) if is_cyan else WHITE
            ink_tint = (150, 150, 150) if is_cyan else (255, 255, 255)
            dpx[x, y] = tuple(round(DARK_BG[i] * (1 - alpha) + ink_dark[i] * alpha) for i in range(3))
            tpx[x, y] = tuple(round(ink_tint[i] * alpha) for i in range(3))

    dark.save(IMAGES / "icon-dark.png")
    tinted.save(IMAGES / "icon-tinted.png")


if __name__ == "__main__":
    main()
