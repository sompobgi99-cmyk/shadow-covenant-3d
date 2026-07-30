from pathlib import Path
from PIL import Image

root = Path('assets/character-bank/frost_warden')
walk = Image.open(root / 'frost_warden_walk.png').convert('RGBA')
cell_w = walk.width // 8
cell_h = walk.height // 8

# The generated frames contain a large transparent strip below the boots.
# Remove the shared minimum gap so the Sprite bottom anchor sits on the floor.
gaps = []
for row in range(8):
    for col in range(8):
        frame = walk.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        bounds = frame.getchannel('A').getbbox()
        gaps.append(cell_h - bounds[3] if bounds else 0)
crop_bottom = min(gaps)
frame_h = cell_h - crop_bottom
cropped_walk = Image.new('RGBA', (cell_w * 8, frame_h * 8), (0, 0, 0, 0))
for row in range(8):
    for col in range(8):
        frame = walk.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, row * cell_h + frame_h))
        cropped_walk.alpha_composite(frame, (col * cell_w, row * frame_h))
cropped_walk.save(root / 'frost_warden_walk.png')
walk = cropped_walk
cell_h = frame_h

# Keep the same grounded frame for the first runtime pass. The sheet layout
# remains compatible with the game's 8-direction animator.
idle = Image.new('RGBA', (cell_w * 4, cell_h * 8), (0, 0, 0, 0))
for row in range(8):
    frame = walk.crop((0, row * cell_h, cell_w, (row + 1) * cell_h))
    for col in range(4):
        idle.alpha_composite(frame, (col * cell_w, row * cell_h))
idle.save(root / 'frost_warden_idle.png')

portrait = Image.open(root / 'frost_warden_topdown.png').convert('RGBA')
# Use an upper-body crop for the character-select portrait, matching the
# framing used by the other playable characters.
portrait = portrait.crop((24, 6, 146, 116))
portrait.thumbnail((96, 96), Image.Resampling.NEAREST)
canvas = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
canvas.alpha_composite(portrait, ((96 - portrait.width) // 2, (96 - portrait.height) // 2))
canvas.save(root / 'frost_warden_portrait.png')

print('cropped bottom gap', crop_bottom)
print('walk', walk.size)
print('idle', idle.size)
print('portrait', canvas.size)
