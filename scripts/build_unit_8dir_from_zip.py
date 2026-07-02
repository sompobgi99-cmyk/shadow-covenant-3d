import sys
import zipfile
from pathlib import Path
from PIL import Image

ORDER = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]


def find_rotation(zf, direction):
    suffix = f"rotations/{direction}.png"
    for name in zf.namelist():
        if name.replace("\\", "/").endswith(suffix):
            return name
    raise KeyError(suffix)


def load_frames(source_path):
    source = Path(source_path)
    frames = []
    if source.is_dir():
        for direction in ORDER:
            frames.append(Image.open(source / f"{direction}.png").convert("RGBA"))
        return frames

    with zipfile.ZipFile(source) as zf:
        for direction in ORDER:
            with zf.open(find_rotation(zf, direction)) as f:
                frames.append(Image.open(f).convert("RGBA"))
    return frames


def build(source_path, key):
    out_dir = Path(__file__).resolve().parents[1] / "assets" / "sprites"
    frames = load_frames(source_path)
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w, h * len(frames)), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        if frame.size != (w, h):
            frame = frame.resize((w, h), Image.Resampling.NEAREST)
        sheet.alpha_composite(frame, (0, i * h))
    out_dir.mkdir(parents=True, exist_ok=True)
    frames[0].save(out_dir / f"{key}.png")
    sheet.save(out_dir / f"{key}_8dir.png")
    print(f"saved {key}.png and {key}_8dir.png ({w}x{h * len(frames)})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: python scripts/build_unit_8dir_from_zip.py <zip-or-rotations-dir> <key>")
    build(sys.argv[1], sys.argv[2])
