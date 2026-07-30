from PIL import Image
import os

source = Image.open('assets/character-bank/frost_warden/frost_warden_8dir_rotation.png').convert('RGB')
cells = {
    # Rotation sheet faces the camera at the top-middle cell, so top = south
    # and bottom = north. Left/right already match the world axes.
    'south-west': (0, 0), 'south': (1, 0), 'south-east': (2, 0),
    'west': (0, 1), 'east': (2, 1),
    'north-west': (0, 2), 'north': (1, 2), 'north-east': (2, 2),
}
out = 'assets/character-bank/frost_warden/starts'
os.makedirs(out, exist_ok=True)
for name, (cx, cy) in cells.items():
    source.crop((cx * 80, cy * 80, (cx + 1) * 80, (cy + 1) * 80)).save(os.path.join(out, f'{name}.png'))
print('saved 8 direction start frames')
