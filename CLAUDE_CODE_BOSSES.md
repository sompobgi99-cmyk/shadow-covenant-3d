# Claude Code — สั่งทีเดียว: สร้างสไปรซ์บอสเฉพาะ 4 ตัว (8 ทิศ) + wire เข้าเกม

วางบล็อก PROMPT ให้ Claude Code (โฟลเดอร์ `C:\work\topdown-survivor\game-3d`, ต่อ PixelLab MCP, ใช้ `py`)

โค้ดมี `const BOSS_TYPES` รออยู่แล้ว — พอสร้างสไปรซ์ `boss_<key>_8dir.png` + ใส่ DIR_SHEETS/MANIFEST
เกมจะใช้ art บอสจริงอัตโนมัติ (ก่อนหน้านี้ยืมหน้ามินิบอสไปก่อน)

---

## PROMPT (ก๊อปทั้งหมด)

```
เป้าหมาย: สร้างสไปรซ์บอส 5 ตัว แบบ 8 ทิศนิ่ง (static rotations) ประกอบเป็นชีต grid ต่อเข้าเกม
ห้ามแก้ระบบอื่นนอกจาก MANIFEST กับ DIR_SHEETS

บอส 5 ตัว (key + prompt):
- boss_lich     : a towering lich king, skeletal undead sorcerer in tattered royal robes, glowing eyes, jagged crown, holding a long staff
- boss_behemoth : a colossal abyssal behemoth, hulking horned demon, dark muscular body with glowing red cracks, monstrous and imposing
- boss_reaper   : a giant soul reaper, hooded grim reaper in a tattered black robe, wielding a huge curved scythe, ghostly glow
- boss_dragon   : a dark void wyrm, sinister wingless-stance dragon, black scales, glowing purple underbelly, menacing
- boss_overlord : a gigantic demonic overlord, the final boss, massive armored body, huge horns, glowing molten core, world-ending presence (generate at size 128, will render very large in game)

Style anchor (เติมท้ายทุกตัว):
  16-bit SNES pixel art, large imposing boss, menacing, dark muted gothic palette, soft top-left moonlight,
  clean crisp pixels, 3/4 front view, transparent background, single character centered, feet at the bottom,
  no ground, no base, no shadow

สำหรับแต่ละบอส:
1) PixelLab: create_character 8 ทิศ (template mannequin, view low top-down, size 128, directions 8)
   description = prompt ของตัวนั้น + style anchor ; อย่ากด animate (เอา rotations นิ่ง)
2) ดึง rotation 8 ทิศ: south, south-east, east, north-east, north, north-west, west, south-west

ประกอบชีต (logic นี้เป๊ะ — แถวบนสุด = south = dir 0):
```python
from PIL import Image
order=['south','south-east','east','north-east','north','north-west','west','south-west']
ims=[<โหลด 8 รูปตามลำดับ order>]
w,h=ims[0].size
def botgap(im):
    bb=im.getbbox(); return (im.height-bb[3]) if bb else 0
crop=min(botgap(im) for im in ims); nh=h-crop
sheet=Image.new('RGBA',(w, nh*8),(0,0,0,0))
for i,im in enumerate(ims):
    sheet.alpha_composite(im.crop((0,0,w,nh)), (0, i*nh))
sheet.save(f"assets/sprites/{KEY}_8dir.png")    # KEY = boss_lich ฯลฯ
```

ต่อเข้าเกม (แก้ index.html 2 จุดต่อ 1 ตัว):
A) const MANIFEST = { ... } เพิ่ม:  <KEY>_8dir:'<KEY>_8dir.png',
B) const DIR_SHEETS = { ... } เพิ่ม:  '<KEY>':{key:'<KEY>_8dir',cols:1,rows:8,fps:1}

(KEY ตรงกับ .sprite ใน BOSS_TYPES: boss_lich, boss_behemoth, boss_reaper, boss_dragon, boss_overlord)
ห้ามแตะ BOSS_TYPES / summonBoss / โค้ดอื่น

เสร็จแล้ว: ดึง <script> จาก index.html แล้ว `node --check`; ยืนยันทุก KEY มีไฟล์+MANIFEST+DIR_SHEETS ครบ;
ตรวจว่าท้ายไฟล์ index.html ยังมี </html> (กัน mount ตัดไฟล์) ; รายงานผล
```

---

## หมายเหตุ (สำหรับคุณ)
- เสร็จแล้วบอสจะสุ่มออกจาก 4 ตัวนี้ (หน้าตาเฉพาะ + ชื่อเฉพาะ) แทนการยืมหน้ามินิบอส
- ถ้าอยากได้ **เฟส/แพตเทิร์นเพิ่ม** (โกรธตอนเลือดน้อย, telegraph, เรียกลูกสมุน) บอกผม เดี๋ยวเขียนให้ในโค้ด
- หลังรันเสร็จ ถ้าเปิดเกมแล้วบอสยังเป็นหน้ามินิบอส = สไปรซ์/wire ยังไม่ครบ ส่ง error มาได้
