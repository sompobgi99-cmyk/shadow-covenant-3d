# Claude Code — สั่งทีเดียว: สร้างสไปรซ์ศัตรู 8 ทิศทั้งหมด + ประกอบ + ต่อเข้าเกม

วางข้อความด้านล่างนี้ทั้งก้อนให้ Claude Code (ที่เปิดในโฟลเดอร์ `C:\work\topdown-survivor\game-3d` และต่อ PixelLab MCP ไว้แล้ว)

---

## PROMPT (ก๊อปทั้งหมดนี้)

```
เป้าหมาย: สร้างสไปรซ์ศัตรู "8 ทิศแบบนิ่ง" (static rotations, ไม่ต้อง animate) ให้ครบทุกตัว
แล้วประกอบเป็นชีต grid ต่อเข้าเกม โดยห้ามแก้ระบบเกมอื่นนอกจากที่ระบุ

แหล่งข้อมูล (อ่านก่อน):
- รายชื่อ + คำอธิบายแต่ละตัว: ไฟล์ PIXELLAB_ENEMY_PROMPTS.md
- รายการ key จริง: const ENEMY_TYPES และ const MINIBOSS_TYPES ใน index.html
  (ใช้ค่า .sprite เป็น key เช่น 'enemy_shade', 'miniboss_troll')

ข้าม 'enemy_shade' (ทำไปแล้ว)

สำหรับศัตรูแต่ละตัว (enemy_* 28 ตัว และ miniboss_* 6 ตัว):
1) ใช้ PixelLab MCP สร้าง character แบบ 8 ทิศ:
   - template: mannequin
   - view: low top-down
   - directions: 8
   - size: 64 สำหรับ enemy_* , 96 สำหรับ miniboss_*
   - description: ใช้ prompt ของตัวนั้นจาก PIXELLAB_ENEMY_PROMPTS.md (รวม style anchor)
   - อย่ากด animate (เอาแค่ rotations 8 ทิศนิ่ง)
2) ดึงรูป rotation ทั้ง 8 ทิศ (south, south-east, east, north-east, north, north-west, west, south-west)

จากนั้นประกอบเป็นชีต grid ด้วย Python (ใช้ logic นี้เป๊ะ เพื่อให้ตรงกับระบบในเกม):
```python
from PIL import Image
order=['south','south-east','east','north-east','north','north-west','west','south-west']  # = dir 0..7
ims=[<โหลดรูป 8 ทิศตามลำดับ order>]            # RGBA
w,h=ims[0].size
def botgap(im):
    bb=im.getbbox(); return (im.height-bb[3]) if bb else 0
crop=min(botgap(im) for im in ims)             # crop ขอบล่างร่วม ลดการลอย
nh=h-crop
sheet=Image.new('RGBA',(w, nh*8),(0,0,0,0))    # 8 แถว แถวบนสุด = south (dir 0)
for i,im in enumerate(ims):
    sheet.alpha_composite(im.crop((0,0,w,nh)), (0, i*nh))
sheet.save(f"assets/sprites/{KEY}_8dir.png")   # KEY เช่น enemy_bone_stalker
```

ต่อเข้าเกม (แก้ index.html เท่านั้น 2 จุด ต่อ 1 ตัว):
A) ใน const MANIFEST = { ... } เพิ่มบรรทัด:
   <KEY>_8dir:'<KEY>_8dir.png',
B) ใน const DIR_SHEETS = { ... } เพิ่ม entry:
   '<KEY>':{key:'<KEY>_8dir',cols:1,rows:8,fps:1}

ห้ามแตะโค้ดอื่น (entitySprite, animSprite, ENEMY_TYPES, ฯลฯ มีระบบรองรับอยู่แล้ว
— ถ้า key มีใน DIR_SHEETS และ texture โหลดได้ เกมจะใช้ 8 ทิศให้อัตโนมัติ)

เสร็จแล้ว:
- ตรวจ syntax: ดึง <script> จาก index.html แล้ว `node --check`
- ยืนยันว่าทุก KEY มีทั้งไฟล์ <KEY>_8dir.png, บรรทัด MANIFEST, และ entry DIR_SHEETS ครบ
- รายงานตัวที่ทำสำเร็จ/ล้มเหลว

หมายเหตุ:
- per-frame เป็นจัตุรัสอยู่แล้ว (เกมคิดสเกลจากค่า height ในเกม ไม่ใช่พิกเซล)
- ถ้าตัวไหน gen ออกมามีฐาน/เงาวงกลมติด ให้ลบออกใน prompt หรือ crop ทิ้ง
```

---

## หมายเหตุก่อนรัน (สำหรับคุณ)

- งานนี้ gen 33 ตัว × 8 ทิศ = ใช้ **เครดิต/เวลา PixelLab เยอะพอควร** เผื่อเวลาไว้
- ถ้าอยากได้ **เฟรมเดินจริง** (ขาขยับ) ด้วย: บอก Claude Code เพิ่มว่า "หลังสร้าง character ให้ animate template=walk 4 เฟรมต่อทิศ แล้วประกอบเป็นชีต cols=4,rows=8" — แล้วบอกผม เดี๋ยวปรับ `DIR_SHEETS` ให้ `cols:4, fps:7`
- ทำเสร็จแล้วเปิดเกม Ctrl+F5 ดูได้เลย ถ้าตัวไหนสเกล/ลอยเพี้ยน ส่งมาบอกผมปรับ height/crop ให้
