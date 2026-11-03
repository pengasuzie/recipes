#!/usr/bin/env python3
"""Generate the recipe-book favicon and PWA icons. Pure-Python via PIL."""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

PINK = (233, 79, 135)         # #e94f87
WHITE = (255, 255, 255)       # #ffffff
BLUE = (66, 133, 212)         # #4285d4

def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), PINK)
    d = ImageDraw.Draw(img)
    # Open recipe book. Keep the whole mark inside the maskable safe zone.
    pad = int(size * (0.22 if maskable else 0.16))
    mid = size // 2
    top = pad + int(size * 0.06)
    bottom = size - pad
    outer = int(size * 0.035)
    d.polygon([(pad, top), (mid - outer, top + outer), (mid - outer, bottom), (pad, bottom - outer)], fill=WHITE)
    d.polygon([(mid + outer, top + outer), (size - pad, top), (size - pad, bottom - outer), (mid + outer, bottom)], fill=WHITE)
    d.line([(mid, top + outer), (mid, bottom)], fill=BLUE, width=max(2, int(size * 0.025)))
    # A few bold recipe lines remain legible at favicon size.
    line_width = max(2, int(size * 0.022))
    for fraction in (0.38, 0.52, 0.66):
        y = int(size * fraction)
        d.line([(pad + outer, y), (mid - int(size * 0.075), y + outer // 2)], fill=BLUE, width=line_width)
        d.line([(mid + int(size * 0.075), y + outer // 2), (size - pad - outer, y)], fill=BLUE, width=line_width)
    return img

for size in (192, 512):
    make_icon(size).save(ICONS / f"icon-{size}.png", "PNG")
make_icon(512, maskable=True).save(ICONS / "icon-512-maskable.png", "PNG")
make_icon(180).save(ICONS / "apple-touch-icon.png", "PNG")

(ICONS / "icon.svg").write_text("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#e94f87"/>
  <path d="M82 143 238 161v224L82 367zM274 161l156-18v224l-156 18z" fill="#fff"/>
  <path d="M256 161v224" stroke="#4285d4" stroke-width="13" stroke-linecap="round"/>
  <g stroke="#4285d4" stroke-width="11" stroke-linecap="round">
    <path d="m100 202 101 12M311 214l101-12M100 269l101 12M311 281l101-12M100 336l101 12M311 348l101-12"/>
  </g>
</svg>\n""", encoding="utf-8")
print("Icons written to icons/")
