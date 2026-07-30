import argparse
from pathlib import Path

from PIL import Image


def build_strip(source: Path, output: Path, frames: int = 6, cell_size: int = 64) -> None:
    image = Image.open(source).convert("RGBA")
    source_cell_width = image.width // frames
    strip = Image.new("RGBA", (cell_size * frames, cell_size), (0, 0, 0, 0))

    for index in range(frames):
        left = index * source_cell_width
        right = image.width if index == frames - 1 else (index + 1) * source_cell_width
        frame = image.crop((left, 0, right, image.height))
        bbox = frame.getchannel("A").getbbox()
        if not bbox:
            continue
        frame = frame.crop(bbox)
        scale = min((cell_size - 6) / frame.width, (cell_size - 6) / frame.height)
        size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
        frame = frame.resize(size, Image.Resampling.NEAREST)
        x = index * cell_size + (cell_size - size[0]) // 2
        y = (cell_size - size[1]) // 2
        strip.alpha_composite(frame, (x, y))

    output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(output, "PNG", optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frames", type=int, default=6)
    parser.add_argument("--cell-size", type=int, default=64)
    args = parser.parse_args()
    build_strip(args.source, args.output, args.frames, args.cell_size)
