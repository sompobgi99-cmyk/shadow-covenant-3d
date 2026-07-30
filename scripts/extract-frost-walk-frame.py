from PIL import Image

source = Image.open('assets/character-bank/frost_warden/frost_warden_8dir_rotation.png').convert('RGB')
# The rotation sheet is a 3x3 layout with the center cell empty.
frame = source.crop((80, 0, 160, 80))
frame.save('assets/character-bank/frost_warden/frost_warden_walk_start.png')
print('saved walk start frame')
