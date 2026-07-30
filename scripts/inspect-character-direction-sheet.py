from PIL import Image, ImageDraw
import sys

name = sys.argv[1] if len(sys.argv) > 1 else 'char_huntress_walk.png'
source = Image.open('assets/sprites/' + name).convert('RGBA')
cols = source.width // 64
rows = 8
out = Image.new('RGBA', (cols * 96, rows * 96), (20, 16, 32, 255))
for row in range(rows):
    for col in range(cols):
        frame = source.crop((col * 64, row * source.height // rows, (col + 1) * 64, (row + 1) * source.height // rows))
        frame = frame.resize((96, 96), Image.Resampling.NEAREST)
        out.alpha_composite(frame, (col * 96, row * 96))
    ImageDraw.Draw(out).text((2, row * 96 + 2), str(row), fill=(255, 220, 150, 255))
out.save('assets/character-bank/frost_warden/reference_existing_character.png')
