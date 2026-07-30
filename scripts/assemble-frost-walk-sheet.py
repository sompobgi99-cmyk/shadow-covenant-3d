from collections import deque
from PIL import Image
import os

directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
source_for_row = {
    # Existing walk files were generated from the first raw-cell labels.
    # Map the raw rotation positions to the game's world-facing directions.
    'south': 'north', 'south-east': 'north-west', 'east': 'west', 'north-east': 'south-west',
    'north': 'south', 'north-west': 'south-east', 'west': 'east', 'south-west': 'north-east',
}
folder = 'assets/character-bank/frost_warden/walk'
cell = 80

def remove_connected_background(image):
    image = image.convert('RGBA')
    pixels = image.load()
    width, height = image.size
    background = pixels[0, 0][:3]
    seen = set()
    queue = deque()
    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y)); queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        color = pixels[x, y][:3]
        distance = sum((color[i] - background[i]) ** 2 for i in range(3)) ** 0.5
        if distance > 28:
            continue
        pixels[x, y] = (*color, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return image

sheet = Image.new('RGBA', (cell * 8, cell * 8), (0, 0, 0, 0))
for row, direction in enumerate(directions):
    source = Image.open(os.path.join(folder, f'{source_for_row[direction]}.png')).convert('RGB')
    for col in range(8):
        frame = source.crop(((col % 4) * cell, (col // 4) * cell, (col % 4 + 1) * cell, (col // 4 + 1) * cell))
        sheet.alpha_composite(remove_connected_background(frame), (col * cell, row * cell))

output = 'assets/character-bank/frost_warden/frost_warden_walk.png'
sheet.save(output)
print(f'saved {output} size={sheet.size}')
