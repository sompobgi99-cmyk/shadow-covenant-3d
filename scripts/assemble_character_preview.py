import os
import sys
from PIL import Image, ImageDraw

folder, stem, *names = sys.argv[1:]
cell = 64
sheet = Image.new('RGBA', (cell * len(names), cell + 18), (20, 16, 32, 255))
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    image = Image.open(os.path.join(folder, f'{stem}_{name}.png')).convert('RGBA')
    image.thumbnail((cell, cell), Image.Resampling.NEAREST)
    x = i * cell + (cell - image.width) // 2
    y = (cell - image.height) // 2
    sheet.alpha_composite(image, (x, y))
    draw.text((i * cell + 2, cell + 2), str(i), fill=(240, 220, 160, 255))
output = os.path.join(folder, f'{stem}_8dir_preview.png')
sheet.save(output)
print(f'saved {output}')
