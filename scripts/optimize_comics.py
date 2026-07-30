from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
COMIC_DIR = ROOT / "assets" / "character-comics"


def optimize(source: Path) -> tuple[int, int, int]:
    full_target = source.with_suffix(".webp")
    thumb_target = source.with_name(f"{source.stem}_thumb.webp")

    with Image.open(source) as opened:
        image = opened.convert("RGB")
        image.save(full_target, "WEBP", quality=88, method=6)

        preview_height = min(image.height, round(image.height * 0.34))
        preview = image.crop((0, 0, image.width, preview_height))
        thumb_width = 180
        thumb_height = max(1, round(preview.height * thumb_width / preview.width))
        preview.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS).save(
            thumb_target, "WEBP", quality=78, method=6
        )

    return source.stat().st_size, full_target.stat().st_size, thumb_target.stat().st_size


before = 0
after = 0
for comic in sorted(COMIC_DIR.glob("comic_*.png")):
    old_size, full_size, thumb_size = optimize(comic)
    before += old_size
    after += full_size + thumb_size
    print(f"{comic.name}: {old_size:,} -> {full_size:,} + {thumb_size:,} bytes")

saved = before - after
percent = (saved / before * 100) if before else 0
print(f"Total: {before:,} -> {after:,} bytes")
print(f"Saved: {saved:,} bytes ({percent:.1f}%)")
