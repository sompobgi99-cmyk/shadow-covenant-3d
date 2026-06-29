# Claude Code — gen หีบ/ศาล/พ่อค้า/พื้น ใหม่ (fsync + verify + retry)

เป้าหมาย: gen 6 ไฟล์นี้ใหม่ให้สมบูรณ์ (รอบก่อนโดนตัดเพราะ flush/sync ไม่ครบ)
โค้ดผูกชื่อ + MANIFEST ไว้แล้ว — แค่วางไฟล์ ไม่ต้องแก้ index.html · ใช้ `py`

---

## PROMPT (ก๊อปทั้งหมด)

```
สร้าง 6 ไฟล์ภาพ วางใน assets/sprites/ ด้วย PixelLab create_map_object ภาพนิ่งภาพเดียว
พื้นหลังโปร่ง ไม่มีฐาน/เงา. ห้ามแก้ index.html.

style ต่อท้ายทุกอัน: ", 16-bit pixel art, transparent background, no ground, no base, no shadow"
- chest_common  (size 48): a closed wooden treasure chest with iron bands, brown
- chest_rare    (size 48): a closed ornate blue treasure chest with silver trim, faint glow
- chest_epic    (size 48): a closed lavish purple treasure chest with gold trim, magical glow
- obj_shrine    (size 48): a small stone shrine pillar with a glowing cyan rune and floating orb
- obj_merchant  (size 48): a hooded traveling merchant npc with backpack and glowing lantern, front view
- px_ground     (size 64): dark mossy stone ground, SEAMLESS TILEABLE (ใช้ create_topdown_tileset ถ้ามี)

*** สำคัญ: เซฟทุกไฟล์ผ่านฟังก์ชันนี้เท่านั้น (กันไฟล์โดนตัดจาก flush/sync ไม่ครบ) ***
```python
import os
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = False   # ถ้าตัดจริง getbbox/load จะ fail

def save_verified(img, path, tries=6):
    img = img.convert('RGBA')
    for k in range(tries):
        with open(path, 'wb') as f:
            img.save(f, 'PNG')
            f.flush(); os.fsync(f.fileno())      # บังคับลงดิสก์ให้ครบก่อน
        # ตรวจซ้ำว่าไฟล์สมบูรณ์
        try:
            t = Image.open(path); t.load()
            if os.path.getsize(path) >= 300 and t.convert('RGBA').getbbox() is not None:
                print(f"OK  {path}  ({os.path.getsize(path)}B)")
                return True
        except Exception as e:
            pass
        print(f"retry {k+1}: {path} truncated, saving again...")
    print(f"FAIL {path} (ยังไม่สมบูรณ์หลัง {tries} ครั้ง)")
    return False

# ใช้: save_verified(pixellab_image, 'assets/sprites/<key>.png')
```

ขั้นตอนต่อไฟล์:
1) gen ภาพด้วย PixelLab ตาม prompt → ได้เป็น PIL Image (ถ้าได้เป็น path/bytes ให้เปิดเป็น Image ก่อน)
2) save_verified(image, 'assets/sprites/<key>.png')   # ห้ามใช้ img.save() เปล่าๆ
3) ทำครบทั้ง 6

สุดท้าย: เปิดตรวจทั้ง 6 อีกครั้ง รายงานขนาด+ผ่าน/ไม่ผ่าน และยืนยัน index.html ท้ายไฟล์มี </html>
```

---

## หมายเหตุ
- altar/portal เสร็จแล้ว (ดี) — รอบนี้แค่ 6 อันนี้
- ถ้ายังมีอันไหน FAIL หลัง 6 ครั้ง → ปัญหาอยู่ที่ฝั่ง mount sync จริงๆ ให้ลองเซฟไป `C:\Temp\` ก่อนแล้ว copy เข้า assets ทีละไฟล์
- วางเสร็จส่งมาบอก เดี๋ยวผมตรวจ (ขนาด >1KB + เปิดได้ + ดูภาพ)
