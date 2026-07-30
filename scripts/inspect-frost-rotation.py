from PIL import Image, ImageDraw
import os

source = Image.open('assets/character-bank/frost_warden/frost_warden_8dir_rotation.png').convert('RGB')
cells = [('top-left',(0,0)),('top',(1,0)),('top-right',(2,0)),('left',(0,1)),('right',(2,1)),('bottom-left',(0,2)),('bottom',(1,2)),('bottom-right',(2,2))]
out = Image.new('RGB',(320,640),(20,16,32))
draw = ImageDraw.Draw(out)
for i,(label,(cx,cy)) in enumerate(cells):
    frame=source.crop((cx*80,cy*80,cx*80+80,cy*80+80)).resize((240,240),Image.Resampling.NEAREST)
    x=(i%2)*160; y=(i//2)*160
    frame.thumbnail((150,130),Image.Resampling.NEAREST)
    out.paste(frame,(x+5,y+20))
    draw.text((x+5,y+3),label,fill=(240,220,160))
out.save('assets/character-bank/frost_warden/frost_warden_rotation_inspect.png')
