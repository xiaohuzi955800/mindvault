#!/usr/bin/env python3
"""Generate MindVault PWA icons and the seed photo (PIL, no network needed).

Run from the app directory:  python3 scripts/generate-assets.py

Outputs:
  public/icons/icon-192.png, icon-512.png, maskable-512.png
  public/apple-touch-icon.png
  public/seed-photo.jpg  (a warm sunset scene for the seeded diary entry)
"""
import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)
PUBLIC = os.path.join(APP_DIR, "public")
ICONS = os.path.join(PUBLIC, "icons")

TEAL = (15, 118, 110, 255)
WHITE = (255, 255, 255, 255)


def draw_vault(draw, cx, cy, r, width):
    """Vault door: outer ring, hub, and 8 spokes."""
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r], outline=WHITE, width=width
    )
    hub = max(2, r // 3)
    draw.ellipse(
        [cx - hub, cy - hub, cx + hub, cy + hub], fill=WHITE
    )
    for angle_deg in range(0, 360, 45):
        a = math.radians(angle_deg)
        x1 = cx + int(math.cos(a) * (hub + width))
        y1 = cy + int(math.sin(a) * (hub + width))
        x2 = cx + int(math.cos(a) * (r - width))
        y2 = cy + int(math.sin(a) * (r - width))
        draw.line([(x1, y1), (x2, y2)], fill=WHITE, width=width)


def make_icon(size, path, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        # Full-bleed square; glyph kept inside the 80% safe zone.
        draw.rectangle([0, 0, size, size], fill=TEAL)
        scale = 0.32
    else:
        radius = int(size * 0.22)
        draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=TEAL)
        scale = 0.40
    r = int(size * scale)
    draw_vault(draw, size // 2, size // 2, r, max(2, size // 32))
    img.convert("RGB").save(path, "PNG")
    print("wrote", path)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_seed_photo(path):
    """Warm sunset over hills — the photo for the seeded 'small win' entry."""
    w, h = 800, 500
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    top = (253, 230, 138)  # warm pale yellow
    mid = (245, 158, 11)  # amber
    bottom = (234, 88, 12)  # deep orange
    for y in range(h):
        t = y / h
        color = lerp(top, mid, t * 1.6) if t < 0.625 else lerp(mid, bottom, (t - 0.625) / 0.375)
        draw.line([(0, y), (w, y)], fill=color)
    # Sun with a soft halo.
    sun_cx, sun_cy, sun_r = 560, 270, 62
    for ring, alpha in [(150, 40), (110, 70), (80, 110)]:
        halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        halo_draw = ImageDraw.Draw(halo)
        halo_draw.ellipse(
            [sun_cx - ring, sun_cy - ring, sun_cx + ring, sun_cy + ring],
            fill=(255, 247, 237, alpha),
        )
        img = Image.alpha_composite(img.convert("RGBA"), halo).convert("RGB")
        draw = ImageDraw.Draw(img)
    draw.ellipse(
        [sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
        fill=(255, 247, 237),
    )
    # Rolling hills, two layers.
    draw.polygon(
        [(0, 400), (150, 350), (320, 395), (520, 345), (680, 390), (800, 360),
         (800, 500), (0, 500)],
        fill=(87, 83, 78),
    )
    draw.polygon(
        [(0, 450), (200, 410), (420, 455), (620, 415), (800, 450),
         (800, 500), (0, 500)],
        fill=(68, 64, 60),
    )
    img.save(path, "JPEG", quality=85)
    print("wrote", path)


def main():
    os.makedirs(ICONS, exist_ok=True)
    make_icon(192, os.path.join(ICONS, "icon-192.png"))
    make_icon(512, os.path.join(ICONS, "icon-512.png"))
    make_icon(512, os.path.join(ICONS, "maskable-512.png"), maskable=True)
    make_icon(180, os.path.join(PUBLIC, "apple-touch-icon.png"))
    make_seed_photo(os.path.join(PUBLIC, "seed-photo.jpg"))


if __name__ == "__main__":
    main()
