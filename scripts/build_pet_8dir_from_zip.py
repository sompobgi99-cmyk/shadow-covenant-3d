import sys
import zipfile
from pathlib import Path
from PIL import Image

ORDER = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]


def build(zip_path, key):
    out_dir = Path(__file__).resolve().parents[1] / "assets" / "sprites"
    with zipfile.ZipFile(zip_path) as zf:
        frames = []
        for direction in ORDER:
            with zf.open(f"rotations/{direction}.png") as f:
                frames.append(Image.open(f).convert("RGBA"))
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w, h * len(frames)), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        if frame.size != (w, h):
            frame = frame.resize((w, h), Image.Resampling.NEAREST)
        sheet.alpha_composite(frame, (0, i * h))
    sheet.save(out_dir / f"pet_{key}_8dir.png")
    frames[0].save(out_dir / f"pet_{key}.png")
    print(f"saved pet_{key}.png and pet_{key}_8dir.png ({w}x{h * len(frames)})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: python scripts/build_pet_8dir_from_zip.py <zip> <pet_key>")
    build(sys.argv[1], sys.argv[2])
