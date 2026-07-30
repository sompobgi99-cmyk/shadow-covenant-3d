from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'item_frost_shard': ROOT / 'tmp' / 'item_frost_shard_source.png',
    'item_frozen_heart': ROOT / 'tmp' / 'item_frozen_heart_source.png',
    'item_ice_crown': ROOT / 'tmp' / 'item_ice_crown_source.png',
}
OUT = ROOT / 'assets' / 'sprites'

for key, src in SOURCES.items():
    im = Image.open(src).convert('RGBA')
    # The generator returned an opaque near-white backdrop. Remove only the
    # edge-connected backdrop so bright ice highlights remain intact.
    px = im.load()
    bg = px[0, 0][:3]
    seen = set()
    queue = deque()
    for x in range(im.width):
        queue.append((x, 0)); queue.append((x, im.height - 1))
    for y in range(im.height):
        queue.append((0, y)); queue.append((im.width - 1, y))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        seen.add((x, y))
        c = px[x, y][:3]
        if max(abs(c[i] - bg[i]) for i in range(3)) > 22:
            continue
        px[x, y] = (*c, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    box = im.getbbox()
    if box:
        im = im.crop(box)
    side = max(im.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    canvas.resize((96, 96), Image.Resampling.LANCZOS).save(OUT / f'{key}.png')
    print('saved', OUT / f'{key}.png')
