from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "assets" / "sprites"


def save(name, draw_fn):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_fn(d)
    im.save(OUT / f"{name}.png")
    print(name)


def px(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def outline_box(d, x, y, w, h, c="#171018"):
    px(d, x, y, w, 2, c); px(d, x, y + h - 2, w, 2, c)
    px(d, x, y, 2, h, c); px(d, x + w - 2, y, 2, h, c)


def ring(d, cx, cy, r, c, hi="#ffffff", dark="#181018"):
    d.ellipse([cx-r-2, cy-r-2, cx+r+2, cy+r+2], fill=dark)
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c)
    d.ellipse([cx-r+4, cy-r+4, cx+r-4, cy+r-4], fill=(0, 0, 0, 0))
    px(d, cx-2, cy-r+1, 4, 2, hi)


def boot(d, c="#4bd8ff"):
    px(d, 9, 6, 8, 14, "#151923"); px(d, 13, 17, 12, 5, "#151923")
    px(d, 11, 7, 5, 12, c); px(d, 14, 18, 10, 3, c)
    px(d, 7, 11, 5, 2, "#fff3a0"); px(d, 6, 15, 5, 2, "#fff3a0")
    px(d, 18, 21, 8, 2, "#ffffff")


icons = {
    "item_lucky_charm": lambda d: (ring(d, 16, 16, 9, "#49d46b"), px(d, 15, 7, 2, 18, "#eaffb8"), px(d, 7, 15, 18, 2, "#eaffb8"), px(d, 11, 11, 3, 3, "#ffffff"), px(d, 18, 18, 3, 3, "#ffffff")),
    "item_dash_boots": lambda d: (boot(d, "#55e6ff"), px(d, 3, 9, 5, 2, "#9ff6ff"), px(d, 2, 14, 6, 2, "#9ff6ff"), px(d, 4, 19, 5, 2, "#9ff6ff")),
    "item_sharpening_stone": lambda d: (outline_box(d, 7, 11, 18, 10), px(d, 9, 13, 14, 6, "#87929c"), px(d, 12, 12, 9, 2, "#dbe6ec"), px(d, 7, 23, 18, 2, "#55372c"), px(d, 21, 6, 3, 18, "#f0f4ff"), px(d, 23, 5, 2, 4, "#ffffff")),
    "item_blink_feather": lambda d: (px(d, 8, 20, 16, 3, "#2a1832"), px(d, 15, 6, 3, 18, "#fff6d0"), px(d, 17, 7, 7, 4, "#9ee7ff"), px(d, 17, 12, 9, 4, "#70c7ff"), px(d, 17, 17, 6, 4, "#4d8fff"), px(d, 6, 8, 4, 2, "#d6f6ff"), px(d, 4, 13, 6, 2, "#d6f6ff")),
    "item_execution_coin": lambda d: (ring(d, 16, 16, 10, "#d39a2f", "#fff0a8"), px(d, 15, 8, 2, 16, "#5b251f"), px(d, 9, 15, 14, 2, "#5b251f"), px(d, 11, 10, 10, 3, "#ffe08a"), px(d, 11, 20, 10, 2, "#ffe08a")),
    "item_phase_cloak": lambda d: (px(d, 8, 7, 16, 3, "#171024"), px(d, 6, 10, 20, 15, "#5b3bb0"), px(d, 9, 11, 14, 13, "#8b68ff"), px(d, 13, 8, 6, 17, "#d6c4ff"), px(d, 4, 15, 5, 2, "#8ff6ff"), px(d, 23, 18, 5, 2, "#8ff6ff")),
    "item_glass_needle": lambda d: (px(d, 14, 3, 4, 25, "#172033"), px(d, 12, 7, 8, 16, "#62e9ff"), px(d, 15, 4, 2, 23, "#ffffff"), px(d, 10, 22, 12, 3, "#b9f7ff"), px(d, 13, 27, 6, 2, "#172033")),
    "item_magnet_coil": lambda d: (px(d, 7, 7, 6, 14, "#18202a"), px(d, 19, 7, 6, 14, "#18202a"), px(d, 9, 9, 3, 11, "#ff5b5b"), px(d, 20, 9, 3, 11, "#5bc8ff"), px(d, 12, 18, 8, 5, "#303846"), px(d, 10, 5, 4, 3, "#ffffff"), px(d, 18, 5, 4, 3, "#ffffff")),
    "item_swift_oil": lambda d: (outline_box(d, 11, 6, 10, 20), px(d, 13, 8, 6, 16, "#58e0ff"), px(d, 14, 5, 4, 3, "#f4d28a"), px(d, 9, 11, 4, 2, "#d8fbff"), px(d, 7, 16, 5, 2, "#d8fbff"), px(d, 21, 20, 4, 2, "#ffffff")),
    "item_runic_lens": lambda d: (ring(d, 16, 15, 10, "#7d48d8", "#f4e8ff"), px(d, 14, 13, 5, 5, "#5fe6ff"), px(d, 17, 16, 8, 8, "#24162b"), px(d, 21, 21, 5, 5, "#8a6244")),
    "item_stopwatch": lambda d: (ring(d, 16, 17, 9, "#c9d4e8", "#ffffff"), px(d, 14, 4, 5, 4, "#d8b45a"), px(d, 15, 10, 2, 8, "#161922"), px(d, 16, 17, 6, 2, "#161922"), px(d, 8, 7, 4, 3, "#d8b45a"), px(d, 20, 7, 4, 3, "#d8b45a")),
    "item_ricochet_charm": lambda d: (ring(d, 16, 16, 8, "#60d68a", "#ffffff"), px(d, 8, 14, 10, 2, "#18221a"), px(d, 16, 10, 2, 6, "#18221a"), px(d, 18, 8, 5, 5, "#f6ffb8"), px(d, 20, 17, 4, 2, "#f6ffb8"), px(d, 22, 19, 2, 4, "#f6ffb8")),
    "item_battle_banner": lambda d: (px(d, 9, 5, 3, 23, "#2b1a17"), px(d, 12, 7, 12, 12, "#c02d3e"), px(d, 12, 19, 8, 4, "#8c1e30"), px(d, 15, 10, 6, 2, "#ffd36a"), px(d, 17, 12, 2, 6, "#ffd36a"), px(d, 7, 27, 8, 2, "#171018")),
    "item_butcher_token": lambda d: (ring(d, 16, 16, 10, "#743238", "#ffd2c8"), px(d, 10, 20, 13, 3, "#1b1214"), px(d, 11, 10, 11, 4, "#d9d9d9"), px(d, 20, 9, 3, 6, "#ffffff"), px(d, 13, 15, 7, 2, "#ff5b5b")),
    "item_royal_jelly": lambda d: (px(d, 9, 13, 14, 10, "#b45aff"), px(d, 11, 10, 10, 5, "#dd9cff"), px(d, 12, 8, 3, 3, "#fff0a8"), px(d, 17, 7, 3, 4, "#fff0a8"), px(d, 21, 10, 3, 3, "#fff0a8"), px(d, 12, 15, 3, 2, "#ffffff"), px(d, 20, 18, 2, 2, "#ffffff"), px(d, 9, 23, 14, 2, "#4b224e")),
}


for name, fn in icons.items():
    save(name, fn)
