# Claude Code — สร้างตัวละครใหม่ 1 ตัว (walk + idle 8 ทิศ + portrait) + wire เข้าเกม

โครงสร้างตอนนี้แยกเป็น js modules แล้ว (ไม่ใช่ index.html) — ไฟล์ที่ต้องแก้:
- `js/game-data.js`  → MANIFEST
- `js/game-runtime.js` → SHEETS + CHARACTERS

เปิด Claude Code ในโฟลเดอร์ `C:\work\topdown-survivor\game-3d` (ต่อ PixelLab MCP, ใช้ `py`)

> แทนที่ `<KEY>` = ชื่อภาษาอังกฤษตัวเล็ก เช่น `warlock`, และเลือก `<WEAPON>` จาก:
> `bolt, spread, nova, orbit, arrow, smite, bladewhirl, soulspiral`

---

## PROMPT (ก๊อปทั้งบล็อก วางให้ Claude Code)

```
เป้าหมาย: สร้างตัวละครเล่นได้ 1 ตัว key=<KEY> พร้อม walk + idle (8 ทิศ) + portrait แล้ว wire เข้าเกม
description ตัวละคร: "<บรรยายรูปร่าง เช่น a hooded warlock in dark robes holding a glowing tome>"
style anchor (เติมท้าย): ", 16-bit SNES pixel art, gothic dark-fantasy hero, 3/4 top-down view,
  clean crisp pixels, transparent background, single character centered, feet at the bottom, no ground, no shadow"

ขั้นตอน:
1) PixelLab create_character 8 ทิศ (template humanoid, view low top-down, size 64) = description + style anchor
2) animate 2 อนิเมชัน: walk และ idle (8 ทิศทั้งคู่)
3) ดึงเฟรมแยกตามทิศ order = [south, south-east, east, north-east, north, north-west, west, south-west]
4) สร้าง portrait: create_map_object ภาพหน้าตรงครึ่งตัว size 96 = description + ", portrait, front view, transparent background"
   save เป็น assets/sprites/char_<KEY>_portrait.png

ประกอบชีต grid (logic นี้เป๊ะ — แถวบนสุด = south = dir 0, คอลัมน์ = เฟรม):
```python
from PIL import Image
order=['south','south-east','east','north-east','north','north-west','west','south-west']
def botgap(im):
    bb=im.getbbox(); return (im.height-bb[3]) if bb else 0
def build(frames_by_dir, outpath):        # frames_by_dir[dir] = [PIL frames]
    cols=len(frames_by_dir['south'])
    allf=[im for d in order for im in frames_by_dir[d]]
    w,h=allf[0].size
    crop=min(botgap(im) for im in allf); nh=h-crop     # crop ขอบล่างร่วม (เท้าติดพื้น)
    sheet=Image.new('RGBA',(w*cols, nh*8),(0,0,0,0))
    for r,d in enumerate(order):
        for c,im in enumerate(frames_by_dir[d]):
            sheet.alpha_composite(im.crop((0,0,w,nh)), (c*w, r*nh))
    with open(outpath,'wb') as f: sheet.save(f,'PNG'); f.flush(); import os; os.fsync(f.fileno())
    return cols
walk_cols = build(walk_frames, 'assets/sprites/char_<KEY>_walk.png')
idle_cols = build(idle_frames, 'assets/sprites/char_<KEY>_idle.png')
print('walk_cols',walk_cols,'idle_cols',idle_cols)
```

wire เข้าเกม (แก้ 3 จุด):

A) js/game-data.js — ใน const MANIFEST { ... } เพิ่ม 3 บรรทัด:
   char_<KEY>_walk:'char_<KEY>_walk.png',
   char_<KEY>_idle:'char_<KEY>_idle.png',
   char_<KEY>_portrait:'char_<KEY>_portrait.png',

B) js/game-runtime.js — ใน const SHEETS = { ... } เพิ่ม entry (ใช้ walk_cols/idle_cols จริง):
   <KEY>: {
     walk: { key:'char_<KEY>_walk', cols:<walk_cols>, rows:8, fps:10 },
     idle: { key:'char_<KEY>_idle', cols:<idle_cols>, rows:8, fps:6 },
     dirRows: [0,7,6,5,4,3,2,1],
   },
   *** สำคัญ: dirRows ต้องเป็น [0,7,6,5,4,3,2,1] เป๊ะ (สไปรซ์ PixelLab กลับซ้าย-ขวา ระบบชดเชยด้วยแถวนี้) ***

C) js/game-runtime.js — ใน const CHARACTERS = { ... } เพิ่ม entry:
   <KEY>: { name:'<ชื่อโชว์>', sheet:'<KEY>', weapon:'<WEAPON>',
            stats:{ maxHp:80, spd:4.6 },     // ปรับได้: maxHp, spd, def, magnet, regen
            passive:{ desc:'+X% ... / lv', apply:p=>{ /* โตทุกเลเวล เช่น p.dmgMul*=1.03 */ } } },

ห้ามแตะ makePlayer, animSprite, entitySprite (รองรับอยู่แล้ว — พอ key มีใน SHEETS+CHARACTERS เกมใช้อัตโนมัติ)

เสร็จแล้ว:
- `npm run check`  (เช็ค syntax ทุกไฟล์)
- ยืนยันไฟล์ครบ: char_<KEY>_walk.png, char_<KEY>_idle.png, char_<KEY>_portrait.png
- ยืนยัน MANIFEST 3 บรรทัด + SHEETS entry (dirRows ถูก) + CHARACTERS entry
- รายงาน walk_cols/idle_cols
```

---

## หมายเหตุ (สำหรับ Sompop)
- ตัวละครใหม่จะโผล่ในหน้าเลือกตัวละครอัตโนมัติ (วนจาก CHARACTERS) พร้อม portrait + passive
- Passive โตทุกเลเวล (apply ถูกเรียกตอน levelUp) — ตั้ง `apply` ให้เบาๆ ต่อเลเวล เช่น `p.dmgMul*=1.03`
- stats ที่ตั้งได้: `maxHp, spd(เดินเริ่ม 4.6), def(เกราะ), magnet(ระยะดูดของ), regen`
- signature weapon ใส่ให้ตอนเริ่ม (weapons:[makeWeapon(weapon)]) — เลือกจาก 8 อาวุธ
- ถ้า portrait ไม่มี เกม fallback เป็นสไปรซ์ตัวละคร ไม่พัง
- ถ้าอยากให้ผมช่วยคิด stats/passive/อาวุธให้สมดุล บอกคอนเซปต์ตัวละครมาได้เลย
