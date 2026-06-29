# Claude Code — สั่งทีเดียว: สร้างตัวละครเล่นได้ (walk + idle, 8 ทิศ) + wire เข้าเกม

วางบล็อก PROMPT ด้านล่างให้ Claude Code (เปิดในโฟลเดอร์ `C:\work\topdown-survivor\game-3d`, ต่อ PixelLab MCP, ใช้ `py` แทน `python3`)

ต่างจากศัตรู: ตัวละครต้องมี **2 อนิเมชัน (walk + idle) แบบ 8 ทิศ** เหมือนฮีโร่

---

## PROMPT (ก๊อปทั้งหมด)

```
เป้าหมาย: สร้างตัวละครเล่นได้ พร้อมอนิเมชัน walk + idle (8 ทิศ) แล้วประกอบเป็นชีต grid
ต่อเข้าเกม ห้ามแก้ระบบอื่นนอกจากที่ระบุ

แหล่งข้อมูล:
- คำอธิบายแต่ละตัว + style anchor: ไฟล์ PIXELLAB_CHARACTER_PROMPTS.md
- key ตัวละคร: const CHARACTERS ใน index.html (ใช้ค่า .sheet เป็น key)

ทำให้ครบ 7 ตัวนี้ (ข้าม paladin ที่ใช้ชีตฮีโร่เดิม):
huntress, sorceress, templar, ranger, necromancer, slayer, priestess

สำหรับแต่ละตัว:
1) PixelLab: create_character แบบ 8 ทิศ (template humanoid/mannequin, view low top-down, size 64),
   description = prompt ของตัวนั้นจาก PIXELLAB_CHARACTER_PROMPTS.md (รวม style anchor)
2) animate 2 อนิเมชัน: walk (เดิน) และ idle (ยืน) — 8 ทิศทั้งคู่
3) ดึงเฟรมของแต่ละอนิเมชัน แยกตามทิศ (south, south-east, east, north-east, north, north-west, west, south-west)

ประกอบเป็นชีต grid (ใช้ logic นี้เป๊ะ เพื่อให้ตรงกับระบบเกม — แถว = ทิศ 0..7, คอลัมน์ = เฟรม):
```python
from PIL import Image
order=['south','south-east','east','north-east','north','north-west','west','south-west']
def botgap(im):
    bb=im.getbbox(); return (im.height-bb[3]) if bb else 0
def build(frames_by_dir, outpath):   # frames_by_dir[dir] = [PIL frames ตามลำดับ]
    cols=len(frames_by_dir['south'])
    allf=[im for d in order for im in frames_by_dir[d]]
    w,h=allf[0].size
    crop=min(botgap(im) for im in allf); nh=h-crop          # crop ขอบล่างร่วม (เท้าติดพื้น)
    sheet=Image.new('RGBA',(w*cols, nh*8),(0,0,0,0))         # row บนสุด = south (dir 0)
    for r,d in enumerate(order):
        for c,im in enumerate(frames_by_dir[d]):
            sheet.alpha_composite(im.crop((0,0,w,nh)), (c*w, r*nh))
    sheet.save(outpath)
    return cols
# walk_cols = build(walk_frames,  f'assets/sprites/char_{KEY}_walk.png')
# idle_cols = build(idle_frames,  f'assets/sprites/char_{KEY}_idle.png')
```

ต่อเข้าเกม (แก้ index.html 2 จุดต่อ 1 ตัว):
A) const MANIFEST = { ... } เพิ่ม:
   char_<KEY>_walk:'char_<KEY>_walk.png',
   char_<KEY>_idle:'char_<KEY>_idle.png',
B) const SHEETS = { ... } เพิ่ม entry (ใช้ walk_cols / idle_cols จริงจากสคริปต์):
   <KEY>:{ walk:{key:'char_<KEY>_walk',cols:<walk_cols>,rows:8,fps:10},
           idle:{key:'char_<KEY>_idle',cols:<idle_cols>,rows:8,fps:6},
           dirRows:[0,1,2,3,4,5,6,7] },

(KEY = huntress/sorceress/... ตรงกับ .sheet ใน CHARACTERS — ระบบมีรองรับอยู่แล้ว
 ถ้า key มีใน SHEETS เกมจะใช้อนิเมชัน 8 ทิศของตัวนั้นอัตโนมัติ)

ห้ามแตะ makePlayer, animSprite, CHARACTERS (มีระบบรองรับแล้ว)

เสร็จแล้ว:
- ดึง <script> จาก index.html แล้ว `node --check`
- ยืนยันแต่ละ KEY มีครบ: ไฟล์ walk+idle, บรรทัด MANIFEST 2 บรรทัด, entry SHEETS
- รายงาน walk_cols/idle_cols ของแต่ละตัว และตัวที่สำเร็จ/ล้มเหลว
```

---

## หมายเหตุ (สำหรับคุณ)
- งานนี้หนักกว่าศัตรู (7 ตัว × 2 อนิเมชัน × 8 ทิศ) — เผื่อเครดิต/เวลา
- เสร็จแล้วบอกผม เดี๋ยวทำ **หน้าจอเลือกตัวละคร (character select)** ก่อนเริ่มเกม + โชว์สตาร์ทคิต/passive ต่อตัว
- ถ้า walk/idle เฟรมไม่เท่าฮีโร่ (6/4) ไม่เป็นไร — สคริปต์เซ็ต cols ให้อัตโนมัติแล้ว
