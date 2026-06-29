# Claude Code — สั่งทีเดียว: สร้างไอคอนอาวุธ 8 ชิ้น (PixelLab)

โค้ดผูก `icon` ของอาวุธไว้รอแล้ว (`wpn_<key>`) + MANIFEST พร้อม — Claude Code **แค่สร้างไฟล์ภาพ**
วางในโฟลเดอร์ `assets/sprites/` ชื่อ `wpn_<key>.png` แล้วเกมใช้อัตโนมัติ (ไม่ต้องแก้ index.html)

---

## PROMPT (ก๊อปทั้งหมด)

```
เป้าหมาย: สร้างไอคอนอาวุธ 8 ชิ้น เป็นภาพไอเทมนิ่งภาพเดียว (ไม่ใช่ 8 ทิศ ไม่ใช่อนิเมชัน)
ใช้ PixelLab create_map_object (วัตถุเดี่ยว) size 64 พื้นหลังโปร่ง แล้ว download
มาวางที่ assets/sprites/ ชื่อไฟล์ wpn_<key>.png (เป๊ะ) — ห้ามแก้ index.html

Style anchor (เติมท้ายทุกอัน):
  16-bit pixel art game item icon, single weapon centered, gothic dark-fantasy, vibrant glow,
  clean crisp pixels, transparent background, no ground, no base, no shadow, no text

8 ไอคอน (key : prompt):
- wpn_bolt        : a glowing purple void magic bolt orb projectile
- wpn_spread      : a pair of ornate flintlock pistols crossed
- wpn_nova        : a fiery orange explosive nova burst orb
- wpn_orbit       : a floating glowing skull with orbiting bone
- wpn_arrow       : a glowing green elven arrow, sharp and sleek
- wpn_smite       : a radiant golden holy war-mace, divine light
- wpn_bladewhirl  : two crossed silver curved blades, whirling
- wpn_soulspiral  : a swirling purple spectral soul vortex / ghostly scythe

ขั้นตอนต่อไอคอน:
1) create_map_object: description = prompt + style anchor, size 64
2) เอาภาพผลลัพธ์ (ภาพเดียว) save เป็น assets/sprites/wpn_<key>.png
   - ถ้าผลลัพธ์มีขอบ/ฐานติด ให้ crop ออกหรือแก้ prompt
   - ถ้าได้มาหลายภาพ/หลายมุม ใช้ภาพหน้าตรงภาพเดียวพอ

เสร็จแล้ว: ยืนยันว่ามีครบ 8 ไฟล์ wpn_*.png ใน assets/sprites/ และรายงานผล
(ไม่ต้องแตะ index.html — แค่วางไฟล์ครบก็พอ)
```

---

## หมายเหตุ (สำหรับคุณ)
- key ตรงกับใน WEAPON_TYPES: bolt, spread, nova, orbit, arrow, smite, bladewhirl, soulspiral
- ไอคอนนี้โชว์บน **การ์ดเลือกอัปเกรด / ร้านค้า / หน้าเลือกตัวละคร** (ไม่เกี่ยวกับกระสุนในเกมที่เป็นทรงเรืองแสงเจนเอง)
- ร่าง evolve (Doom Bolt ฯลฯ) ใช้ไอคอนเดียวกับอาวุธฐาน
- วางเสร็จเปิดเกม Ctrl+F5 → การ์ดอาวุธจะมีไอคอนเฉพาะตัว ไม่ซ้ำกันแล้ว
