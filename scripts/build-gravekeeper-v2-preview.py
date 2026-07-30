from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/character-bank/gravekeeper_v2/source/master_south_passing_alpha.png"
OUT = ROOT / "assets/character-bank/gravekeeper_v2/preview"
CELL = 96
TARGET_HEIGHT = 72
BASELINE = 88
CHROMA = (255, 0, 255)


def remove_chroma(image: Image.Image) -> Image.Image:
    return image.convert("RGBA")


def subject_canvas() -> Image.Image:
    source = remove_chroma(Image.open(SOURCE))
    bbox = source.getbbox()
    if bbox is None:
        raise RuntimeError("Gravekeeper master contains no subject")
    subject = source.crop(bbox)
    scale = TARGET_HEIGHT / subject.height
    subject = subject.resize((round(subject.width * scale), TARGET_HEIGHT), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CELL - subject.width) // 2, BASELINE - subject.height))
    return canvas


def move_region(image: Image.Image, box: tuple[int, int, int, int], dx: int, dy: int) -> None:
    x0, y0, x1, y1 = box
    region = image.crop(box)
    mask = Image.new("L", region.size, 0)
    ImageDraw.Draw(mask).rectangle((0, 0, region.width - 1, region.height - 1), fill=255)
    image.paste((0, 0, 0, 0), box)
    image.paste(region, (x0 + dx, y0 + dy), mask)


def frame(phase: int) -> Image.Image:
    image = subject_canvas()
    # The master is front-facing. The lower-body windows isolate the two boots;
    # the upper body remains pixel-identical in every frame.
    left = (28, 60, 49, 89)
    right = (48, 60, 69, 89)
    arm_left = (20, 43, 32, 66)
    arm_right = (64, 43, 76, 66)
    poses = [
        ((0, 0), (0, 0), (0, 0), (0, 0)),
        ((-4, 1), (4, -1), (-2, 1), (2, -1)),
        ((-6, 2), (6, -2), (-3, 2), (3, -2)),
        ((4, -1), (-4, 1), (2, -1), (-2, 1)),
    ]
    leg_left, leg_right, arm_l, arm_r = poses[phase]
    move_region(image, left, *leg_left)
    move_region(image, right, *leg_right)
    move_region(image, arm_left, *arm_l)
    move_region(image, arm_right, *arm_r)
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = [frame(i) for i in range(4)]
    sheet = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    for index, image in enumerate(frames):
        image.save(OUT / f"south_{index}.png")
        sheet.alpha_composite(image, (index * CELL, 0))
    sheet.save(OUT / "gravekeeper_v2_south_walk_preview.png")
    print(f"saved {len(frames)} frames and {sheet.size[0]}x{sheet.size[1]} preview")


if __name__ == "__main__":
    main()
