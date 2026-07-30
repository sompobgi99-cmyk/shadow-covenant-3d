from pathlib import Path
from PIL import Image

source = Image.open('tmp/frost_warden_portrait_clean.png').convert('RGBA')
box = source.getchannel('A').getbbox()
if not box:
    raise SystemExit('portrait has no visible pixels')
subject = source.crop(box)
side = max(subject.width, subject.height)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(subject, ((side - subject.width) // 2, (side - subject.height) // 2))
canvas = canvas.resize((96, 96), Image.Resampling.NEAREST)
out = Path('assets/character-bank/frost_warden/frost_warden_portrait.png')
canvas.save(out)
print('source crop', box, 'saved', out, canvas.size)
