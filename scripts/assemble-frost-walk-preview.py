from PIL import Image, ImageDraw
import os

directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
source_for_row = {
    # Existing walk files were generated from the first raw-cell labels.
    # Map the raw rotation positions to the game's world-facing directions.
    'south': 'north', 'south-east': 'north-west', 'east': 'west', 'north-east': 'south-west',
    'north': 'south', 'north-west': 'south-east', 'west': 'east', 'south-west': 'north-east',
}
folder = 'assets/character-bank/frost_warden/walk'
tile_w, tile_h = 320, 178
preview = Image.new('RGB', (tile_w * 2, tile_h * 4), (24, 20, 36))
draw = ImageDraw.Draw(preview)
for i, direction in enumerate(directions):
    image = Image.open(os.path.join(folder, f'{source_for_row[direction]}.png')).convert('RGBA')
    image.thumbnail((tile_w, 160), Image.Resampling.NEAREST)
    x = (i % 2) * tile_w + (tile_w - image.width) // 2
    y = (i // 2) * tile_h + 16
    preview.paste(image, (x, y), image if 'A' in image.getbands() else None)
    draw.text(((i % 2) * tile_w + 8, (i // 2) * tile_h + 2), direction, fill=(240, 220, 160))
output = 'assets/character-bank/frost_warden/frost_warden_walk_8dir_preview.png'
preview.save(output)
print(f'saved {output}')
