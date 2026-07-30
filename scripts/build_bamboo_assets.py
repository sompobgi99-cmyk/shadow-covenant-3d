from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"
PIXELLAB_CHARACTER_DIR = ROOT / ".tmp_bamboo_character" / "Bamboo_Shoot_Man"
ORDER = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]


def trim_to_box(im):
    box = im.getbbox()
    if not box:
        return im
    crop = im.crop(box)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    x = (im.width - crop.width) // 2
    y = im.height - crop.height
    out.alpha_composite(crop, (x, y))
    return out


def make_character_sheets():
    anim_dir = PIXELLAB_CHARACTER_DIR / "animations"
    if anim_dir.exists():
        walk_cols = build_pixellab_sheet(anim_dir / "walk", SPR / "char_bamboo_man_walk.png")
        idle_cols = build_pixellab_sheet(anim_dir / "idle", SPR / "char_bamboo_man_idle.png")
        south = PIXELLAB_CHARACTER_DIR / "rotations" / "south.png"
        if south.exists():
            portrait = Image.open(south).convert("RGBA").resize((96, 96), Image.Resampling.NEAREST)
            portrait.save(SPR / "char_bamboo_man_portrait.png")
            portrait.save(SPR / "char_bamboo_man_source.png")
        print(f"pixelLab sheets walk_cols={walk_cols} idle_cols={idle_cols}")
        return walk_cols, idle_cols

    src = Image.open(SPR / "char_bamboo_man_source.png").convert("RGBA").resize((96, 96), Image.Resampling.NEAREST)
    src = trim_to_box(src)
    walk_cols, idle_cols, rows = 6, 4, 8
    walk = Image.new("RGBA", (96 * walk_cols, 96 * rows), (0, 0, 0, 0))
    idle = Image.new("RGBA", (96 * idle_cols, 96 * rows), (0, 0, 0, 0))
    walk_offsets = [0, -2, 0, 1, 0, -1]
    idle_offsets = [0, -1, 0, 1]
    for r in range(rows):
        row_img = src
        if r in (2, 3, 6, 7):
            row_img = src.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        for c, oy in enumerate(walk_offsets):
            frame = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
            frame.alpha_composite(row_img, (0, oy))
            if c in (1, 4):
                d = ImageDraw.Draw(frame)
                d.rectangle((38, 86, 42, 90), fill=(78, 61, 39, 190))
            elif c in (2, 5):
                d = ImageDraw.Draw(frame)
                d.rectangle((53, 86, 57, 90), fill=(78, 61, 39, 190))
            walk.alpha_composite(frame, (c * 96, r * 96))
        for c, oy in enumerate(idle_offsets):
            frame = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
            frame.alpha_composite(row_img, (0, oy))
            idle.alpha_composite(frame, (c * 96, r * 96))
    walk.save(SPR / "char_bamboo_man_walk.png")
    idle.save(SPR / "char_bamboo_man_idle.png")
    return walk_cols, idle_cols


def botgap(im):
    box = im.getbbox()
    return (im.height - box[3]) if box else 0


def build_pixellab_sheet(anim_path, outpath):
    frames_by_dir = {}
    for direction in ORDER:
        files = sorted((anim_path / direction).glob("frame_*.png"))
        if not files:
            raise FileNotFoundError(f"missing frames for {anim_path.name}/{direction}")
        frames_by_dir[direction] = [Image.open(p).convert("RGBA") for p in files]
    cols = len(frames_by_dir["south"])
    all_frames = [im for direction in ORDER for im in frames_by_dir[direction]]
    w, h = all_frames[0].size
    crop = min(botgap(im) for im in all_frames)
    nh = h - crop
    sheet = Image.new("RGBA", (w * cols, nh * len(ORDER)), (0, 0, 0, 0))
    for r, direction in enumerate(ORDER):
        frames = frames_by_dir[direction]
        if len(frames) != cols:
            raise ValueError(f"{direction} has {len(frames)} frames, expected {cols}")
        for c, im in enumerate(frames):
            sheet.alpha_composite(im.crop((0, 0, w, nh)), (c * w, r * nh))
    sheet.save(outpath)
    return cols


def px(draw, x, y, w, h, color):
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def make_weapon_icon(path, evolved=False):
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    soil = (70, 42, 32, 255)
    dark = (32, 27, 32, 255)
    green = (95, 176, 76, 255)
    light = (180, 242, 103, 255)
    gold = (255, 212, 96, 255)
    glow = (120, 255, 154, 110)
    d.ellipse((6, 40, 58, 58), fill=(18, 13, 20, 110))
    d.ellipse((10, 38, 54, 54), fill=soil)
    d.arc((8, 34, 56, 60), 185, 355, fill=gold if evolved else green, width=2)
    if evolved:
        d.ellipse((5, 17, 59, 61), outline=glow, width=3)
        d.ellipse((13, 25, 51, 59), outline=(255, 232, 127, 120), width=2)
    spikes = [(18, 42, 26, 13), (28, 45, 34, 8), (38, 43, 47, 15), (10, 46, 17, 25), (47, 47, 54, 27)]
    if evolved:
        spikes += [(23, 47, 29, 20), (34, 47, 40, 18)]
    for x1, y1, x2, y2 in spikes:
        d.polygon([(x1, y1), ((x1 + x2) // 2, y2), (x2, y1)], fill=dark)
        d.polygon([(x1 + 1, y1 - 1), ((x1 + x2) // 2, y2 + 2), (x2 - 2, y1 - 1)], fill=gold if evolved else green)
        d.line((x1 + 3, y1 - 3, (x1 + x2) // 2, y2 + 4), fill=(255, 255, 210, 220), width=1)
    for x, y in [(14, 38), (31, 35), (48, 39), (23, 50), (42, 50)]:
        px(d, x, y, 3, 2, gold if evolved else light)
    im.save(SPR / path)


walk_cols, idle_cols = make_character_sheets()
make_weapon_icon("wpn_bamboo_spikes.png", False)
make_weapon_icon("wpn_bamboo_spikes_evolved.png", True)
print(f"built bamboo character sheets and weapon icons: walk_cols={walk_cols}, idle_cols={idle_cols}")
