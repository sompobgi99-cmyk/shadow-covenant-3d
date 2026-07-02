# Claude Code — สร้างมอนสเตอร์ใหม่ (สไปรซ์ 8 ทิศ) + wire เข้าเกม

**ข่าวดี:** ตอนนี้ MANIFEST / DIR_SHEETS / WALK_SHEETS **derive อัตโนมัติจาก ENEMY_TYPES** แล้ว
→ เพิ่มมอนสเตอร์ = แก้แค่ **1 บรรทัดใน ENEMY_TYPES** + วางไฟล์สไปรซ์ (ไม่ต้องแตะ MANIFEST/DIR_SHEETS เอง)

เปิด Claude Code ในโฟลเดอร์ `C:\work\topdown-survivor\game-3d` (ต่อ PixelLab MCP, ใช้ `py`)

> แทน `<KEY>` = ชื่ออังกฤษตัวเล็ก มี `_` เช่น `frost_wraith` → sprite = `enemy_frost_wraith`

---

## PROMPT (ก๊อปทั้งบล็อก วางให้ Claude Code)

```
เป้าหมาย: สร้างมอนสเตอร์ 1 ตัว key=<KEY> เป็นสไปรซ์ 8 ทิศนิ่ง (static rotations) แล้ว wire เข้าเกม
description: "<บรรยายรูปร่าง เช่น a floating frost wraith, icy tattered robes, glowing blue eyes>"
style anchor (เติมท้าย): ", 16-bit SNES pixel art, gothic dark-fantasy monster, menacing, 3/4 top-down view,
  clean crisp pixels, transparent background, single creature centered, feet at the bottom, no ground, no shadow"

ขั้นตอน:
1) PixelLab create_character 8 ทิศ (template creature/humanoid, view low top-down, size 64) = description + style anchor
   *อย่ากด animate — เอา rotation นิ่ง 8 ทิศพอ
2) ดึง rotation 8 ทิศ order = [south, south-east, east, north-east, north, north-west, west, south-west]
3) ประกอบเป็นชีต 8 ทิศ (คอลัมน์เดียว 8 แถว — แถวบนสุด = south = dir 0):
```python
from PIL import Image, os
order=['south','south-east','east','north-east','north','north-west','west','south-west']
ims=[ <โหลด 8 รูปตามลำดับ order> ]
w,h=ims[0].size
def botgap(im):
    bb=im.getbbox(); return (im.height-bb[3]) if bb else 0
crop=min(botgap(im) for im in ims); nh=h-crop        # crop ขอบล่างร่วม (เท้าติดพื้น)
sheet=Image.new('RGBA',(w, nh*8),(0,0,0,0))
for i,im in enumerate(ims):
    sheet.alpha_composite(im.crop((0,0,w,nh)), (0, i*nh))
p='assets/sprites/enemy_<KEY>_8dir.png'
with open(p,'wb') as f: sheet.save(f,'PNG'); f.flush(); os.fsync(f.fileno())
print('saved',p)
```
   (ทำภาพนิ่งหน้าตรงอีก 1 ไฟล์ก็ดี = assets/sprites/enemy_<KEY>.png ใช้เป็น fallback)

wire เข้าเกม (แก้ที่เดียว!):

js/game-data.js — ใน const ENEMY_TYPES = [ ... ] เพิ่ม 1 บรรทัด:
   { name:'<ชื่อโชว์>', hp:<HP>, atk:<ATK>, spd:<SPD>, xp:<XP>, h:<H>, sprite:'enemy_<KEY>', tier:<0|1|2> },

ค่าอ้างอิง (ดูตัวอื่นในไฟล์ประกอบ):
- hp: 10–55 (ปกติ) · atk: 6–24 · spd: 45–150 (px/s, หารด้วย 28 เป็น world) · xp: 5–22
- h: ความสูง 1.1–2.3 (ยิ่งสูงยิ่งตัวใหญ่ + รัศมีชนใหญ่) · tier: 0=Bleakfield, 1=Fenmire, 2=Void Rift

(ไม่ต้องแตะ MANIFEST / DIR_SHEETS / WALK_SHEETS — โค้ด derive จาก sprite ให้อัตโนมัติ)

พฤติกรรมพิเศษ (ถ้าต้องการ) — js/game-runtime.js เพิ่ม '<ชื่อโชว์>' ลงใน Set ที่ต้องการ:
   const SHOOTERS  = new Set([... ,'<ชื่อโชว์>'])   // ถอยยิงระยะไกล
   const CHARGERS  = new Set([... ,'<ชื่อโชว์>'])   // พุ่งชาร์จ
   const EXPLODERS = new Set([... ,'<ชื่อโชว์>'])   // ระเบิดตอนตาย
   const AIRBORNE  = new Set([... ,'<ชื่อโชว์>'])   // นับเป็นศัตรูบิน (Eagle Claw)
   * ไม่ใส่ที่ไหน = พฤติกรรม chase (ไล่ตรงๆ) เป็นค่าเริ่มต้น

เสร็จแล้ว:
- `npm run check`
- ยืนยันไฟล์ enemy_<KEY>_8dir.png (+ enemy_<KEY>.png) มีจริง และ ENEMY_TYPES มีบรรทัดใหม่
- เปิดเกมช่วง tier ตรงกับที่ตั้ง จะเห็นมอนสเตอร์สปอว์น
```

---

## หมายเหตุ (สำหรับ Sompop)
- ระบบ derive: โค้ด `deriveSpriteManifest()` (game-data.js) + auto-fill DIR/WALK (game-runtime.js) เติม key ให้เอง
  → ตราบใดที่ตั้ง `sprite:'enemy_<KEY>'` และวางไฟล์ชื่อตรง เกมหาเจอเอง
- อยากได้ **walk animation** ด้วย ให้ทำ strip 4 เฟรมแนวนอน save เป็น `enemy_<KEY>_walk.png` (เกมใช้ตอนไม่มี 8dir)
  แต่ 8dir สวยกว่าและระบบเลือก 8dir ก่อนเสมอ
- อยากทำ **มินิบอส/บอส** ใช้แนวเดียวกัน แต่เพิ่มใน `MINIBOSS_TYPES` / `BOSS_TYPES` (sprite: `miniboss_<KEY>` / `boss_<KEY>`)
  แล้วไปผูกสกิลใน `MB_SKILLS` / `BOSS_SKILLS` (game-systems.js) — บอกผมได้ เดี๋ยวทำ prompt บอสให้
- บอกคอนเซปต์+tier+สายพฤติกรรมมา ผมช่วยตั้ง hp/atk/spd/xp ให้สมดุลกับ roster เดิมได้
```
