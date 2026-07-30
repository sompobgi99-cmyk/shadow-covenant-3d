"""Convert signature-FX sprites to lossy WebP.

Unlike optimize_webp.py (lossless, pixel-verified — used for grounds/portals
where art must stay exact), signature FX are momentary additive flashes, so
lossy q85 is visually safe and shrinks the painterly 1254x1254 sheets ~5x.
Run after adding or editing any file in assets/sprites/fx-signature/.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FX_DIR = ROOT / "assets" / "sprites" / "fx-signature"
QUALITY = 85

before = after = 0
for src in sorted(FX_DIR.glob("*.png")):
    target = src.with_suffix(".webp")
    with Image.open(src) as opened:
        opened.convert("RGBA").save(target, "WEBP", quality=QUALITY, method=6)
    b, a = src.stat().st_size, target.stat().st_size
    before += b
    after += a
    print(f"{src.name}: {b:,} -> {a:,} bytes ({a * 100 // b}%)")

saved = before - after
percent = (saved / before * 100) if before else 0
print(f"Total: {before:,} -> {after:,} bytes")
print(f"Saved: {saved:,} bytes ({percent:.1f}%)")
