from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "sprites"
FRAME = 128
COUNT = 6


def centered_transform(src, scale=1.0, angle=0, dx=0, dy=0, alpha=1.0):
    side = max(1, round(FRAME * scale))
    im = src.resize((side, side), Image.Resampling.NEAREST)
    if angle:
        im = im.rotate(angle, resample=Image.Resampling.NEAREST, expand=False)
    if alpha < 1:
        a = im.getchannel("A").point(lambda value: round(value * alpha))
        im.putalpha(a)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    frame.alpha_composite(im, ((FRAME - side) // 2 + dx, (FRAME - side) // 2 + dy))
    return frame


def make_sheet(key):
    src = Image.open(SPRITES / f"fx_divine_{key}_source.png").convert("RGBA")
    src = src.resize((FRAME, FRAME), Image.Resampling.NEAREST)
    sheet = Image.new("RGBA", (FRAME * COUNT, FRAME), (0, 0, 0, 0))

    for i in range(COUNT):
        if key in {"astra", "nhal", "eirene"}:
            scales = [0.72, 0.88, 1.00, 1.07, 1.12, 1.18]
            angles = [0, -12, -25, -39, -54, -72]
            frame = centered_transform(src, scales[i], angles[i], alpha=1 if i < 5 else 0.72)
        elif key == "morvane":
            scales = [0.72, 0.86, 0.98, 1.04, 1.08, 1.12]
            frame = centered_transform(src, scales[i], 0, dx=-12 + i * 4, dy=7 - i, alpha=[0.45, .72, 1, 1, .82, .55][i])
        elif key == "solarius":
            scales = [0.62, 0.82, 0.98, 1.06, 1.12, 1.18]
            frame = centered_transform(src, scales[i], 0, dy=8 - i * 2, alpha=[.50, .78, 1, 1, .86, .58][i])
            frame = ImageEnhance.Brightness(frame).enhance([.72, .90, 1.08, 1.22, 1.05, .82][i])
        elif key == "serapha":
            scales = [0.74, 0.88, 1.00, 1.08, 1.02, 0.90]
            frame = centered_transform(src, scales[i], 0, dy=7 - i, alpha=[.48, .76, 1, 1, .82, .56][i])
        elif key == "tharos":
            scales = [0.82, 0.92, 1.00, 1.04, 1.07, 1.10]
            frame = centered_transform(src, scales[i], 0, alpha=[.72, .86, 1, .94, .80, .60][i])
            if i:
                draw = ImageDraw.Draw(frame)
                color = (220, 242, 255, min(245, 115 + i * 24))
                cracks = [((64, 34), (61, 51), (70, 61)), ((89, 45), (76, 58), (83, 74)), ((42, 54), (55, 65), (48, 82)), ((70, 61), (62, 78), (68, 98)), ((55, 65), (38, 72), (31, 88))]
                for points in cracks[:i]:
                    draw.line(points, fill=color, width=1)
        else:
            frame = centered_transform(src)
        sheet.alpha_composite(frame, (i * FRAME, 0))

    out = SPRITES / f"fx_divine_{key}.png"
    sheet.save(out, optimize=True)
    print(out.name, sheet.size)


def main():
    for key in ("astra", "morvane", "solarius", "nhal", "serapha", "tharos", "eirene"):
        make_sheet(key)


if __name__ == "__main__":
    main()
