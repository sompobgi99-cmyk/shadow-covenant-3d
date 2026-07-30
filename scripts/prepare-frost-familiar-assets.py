from pathlib import Path
from PIL import Image

def make_icon(source, target):
    image = Image.open(source).convert('RGBA')
    box = image.getchannel('A').getbbox()
    if not box:
        raise SystemExit(f'no visible pixels in {source}')
    subject = image.crop(box)
    side = max(subject.width, subject.height)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((side - subject.width) // 2, (side - subject.height) // 2))
    canvas.resize((96, 96), Image.Resampling.NEAREST).save(target)

out = Path('assets/sprites')
make_icon('tmp/frost_familiar_clean.png', out / 'wpn_frost_familiar.png')
make_icon('tmp/frozen_sentinel_clean.png', out / 'wpn_frozen_sentinel.png')
print('saved Frost Familiar and Frozen Sentinel icons')
