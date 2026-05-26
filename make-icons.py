#!/usr/bin/env python3
"""Generate PWA icons (192, 512, 512-maskable, apple-touch). Pure-Python via PIL."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

ACCENT = (196, 80, 42)        # #c4502a
CREAM = (246, 240, 230)       # #f6f0e6
INK = (31, 26, 22)            # #1f1a16

def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), ACCENT)
    d = ImageDraw.Draw(img)
    # Maskable icons need a safe zone (inner ~80%)
    pad = int(size * 0.18) if not maskable else int(size * 0.22)
    # Soft cream plate
    plate_r = (size - pad * 2) // 2
    cx, cy = size // 2, size // 2
    d.ellipse(
        [cx - plate_r, cy - plate_r, cx + plate_r, cy + plate_r],
        fill=CREAM,
    )
    # "R" monogram, centered
    try:
        font_path = "/System/Library/Fonts/SFNS.ttf"
        if not Path(font_path).exists():
            font_path = "/System/Library/Fonts/Helvetica.ttc"
        font = ImageFont.truetype(font_path, int(size * 0.5))
    except Exception:
        font = ImageFont.load_default()
    text = "R"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        (cx - tw // 2 - bbox[0], cy - th // 2 - bbox[1] - int(size * 0.02)),
        text,
        fill=ACCENT,
        font=font,
    )
    return img

for size in (192, 512):
    make_icon(size).save(ICONS / f"icon-{size}.png", "PNG")
make_icon(512, maskable=True).save(ICONS / "icon-512-maskable.png", "PNG")
make_icon(180).save(ICONS / "apple-touch-icon.png", "PNG")
print("Icons written to icons/")
