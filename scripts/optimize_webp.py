from pathlib import Path
from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "assets/ui/title-covenant.png",
    "assets/sprites/map2_ground.png",
    "assets/sprites/map2_border_wall.png",
    "assets/sprites/map3_ground.png",
    "assets/sprites/map3_border_wall.png",
    "assets/sprites/floor_challenge_treasure.png",
    "assets/sprites/floor_challenge_cursed.png",
    "assets/sprites/floor_challenge_butcher.png",
    "assets/sprites/floor_challenge_soul.png",
    "assets/sprites/floor_challenge_merchant.png",
    "assets/sprites/obj_normal_portal.png",
    "assets/sprites/obj_challenge_gate.png",
]


def optimize(relative_path: str) -> tuple[int, int]:
    source = ROOT / relative_path
    target = source.with_suffix(".webp")
    with Image.open(source) as opened:
        original = opened.convert("RGBA")
        original.save(target, "WEBP", lossless=True, quality=100, method=6, exact=True)
    with Image.open(target) as encoded:
        decoded = encoded.convert("RGBA")
    if ImageChops.difference(original, decoded).getbbox() is not None:
        target.unlink(missing_ok=True)
        raise RuntimeError(f"Pixel mismatch after lossless conversion: {relative_path}")
    return source.stat().st_size, target.stat().st_size


before = 0
after = 0
for item in FILES:
    old_size, new_size = optimize(item)
    before += old_size
    after += new_size
    print(f"{item}: {old_size:,} -> {new_size:,} bytes")

saved = before - after
percent = (saved / before * 100) if before else 0
print(f"Total: {before:,} -> {after:,} bytes")
print(f"Saved: {saved:,} bytes ({percent:.1f}%)")
