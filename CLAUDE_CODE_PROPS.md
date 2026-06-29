# Claude Code — สั่งทีเดียว: สร้าง asset ที่เหลือทั้งหมด (PixelLab) + วางทับ

โค้ดผูกชื่อไฟล์ไว้รอแล้วทุกตัว — Claude Code **แค่สร้างไฟล์ภาพ** วางทับชื่อเดิมใน `assets/sprites/`
**ไม่ต้องแก้ index.html** ทั้งหมดเป็นภาพนิ่งภาพเดียว (create_map_object) ยกเว้นพื้น (ดูหมายเหตุ)

> เคล็ด: ใช้ `py` แทน `python3` · ทุกภาพพื้นหลังโปร่ง ไม่มีฐาน/เงา · ถ้ามีฐานติดให้ crop ออก

---

## PROMPT (ก๊อปทั้งหมด)

```
เป้าหมาย: สร้างไฟล์ภาพ asset ตามรายการ วางทับชื่อเดิมใน assets/sprites/ (ห้ามแก้ index.html)
ทุกอันใช้ PixelLab create_map_object ภาพนิ่งภาพเดียว พื้นหลังโปร่ง ตรงตามชื่อไฟล์เป๊ะ

=== กลุ่ม D: วัตถุในเกม (size 48) — style: 16-bit gothic game prop ===
chest_common    : a wooden treasure chest with iron bands, closed, brown
chest_rare      : an ornate blue treasure chest with silver trim, closed, glowing faint
chest_epic      : a lavish purple treasure chest with gold trim, closed, magical glow
obj_shrine      : a small stone shrine pillar with a glowing cyan rune and floating orb
obj_merchant    : a hooded traveling merchant npc with a backpack and a glowing lantern, front view

=== กลุ่ม E: ไอคอน tome (size 48) — style: 16-bit pixel art magic tome/rune icon, single item centered, transparent, no text ===
tomeic_might      : red sword/fist rune (damage)
tomeic_vitality   : green heart (max HP)
tomeic_celerity   : yellow lightning bolt (attack speed)
tomeic_precision  : blue target/crosshair (range)
tomeic_multishot  : three arrows fanning (extra projectile)
tomeic_swiftness  : winged boot (move speed)
tomeic_regen      : green cross with sparkle (HP regen)
tomeic_magnet     : horseshoe magnet, blue glow (pickup range)
tomeic_exp        : glowing blue star/gem (XP gain)
tomeic_greed      : gold coin stack (gold)
tomeic_fortitude  : grey shield (armor)
tomeic_lifesteal  : red droplet/fang (lifesteal)
tomeic_duration   : hourglass, purple (projectile life)
tomeic_velocity   : blue motion arrow (projectile speed)
tomeic_growth     : expanding orb, orange (projectile size)

วิธีทำแต่ละไฟล์:
1) create_map_object: description = "<prompt> , 16-bit pixel art, transparent background, no ground, no base, no shadow", size ตามกลุ่ม
2) save ภาพผลลัพธ์เป็น assets/sprites/<key>.png (ชื่อเป๊ะ) ; ถ้ามีฐาน/หลายมุม ใช้ภาพหน้าตรงภาพเดียว/crop

=== พื้น (พิเศษ) ===
px_ground : สร้างพื้นหินมอสมืดแบบ "ต่อกระเบื้องไร้รอยต่อ (seamless tileable)" 64x64
  ใช้ create_topdown_tileset หรือ create_map_object ที่ seamless ; save เป็น assets/sprites/px_ground.png

เสร็จแล้ว: ยืนยันว่าไฟล์ครบทุกชื่อในรายการ และ index.html ท้ายไฟล์ยังมี </html> (กัน mount ตัด) ; รายงานผล
```

---

## หมายเหตุ (สำหรับคุณ)
- เหลือ ≈ 21 ไฟล์ (D: 5, E: 15, พื้น: 1) — แบ่งทำทีละกลุ่มก็ได้ (D→E→พื้น)
- (ต้นไม้/ของประดับ/ซากปราสาท ตัดออกแล้ว — ทำไว้แล้ว)
- โค้ดพร้อมรับทุกชื่อแล้ว วางทับได้เลย เปิดเกม Ctrl+F5 เห็นผลทันที
- ถ้ากลุ่มไหนยังไม่ทำ ก็ใช้รูปวาดเอง (PIL) เดิมไปก่อน ไม่พัง
- `px_wisp` กับ tome icon ที่ต้องเรือง: ถ้า PixelLab ใส่ขอบดำมาแล้วทึบ ส่งมาบอกผมลบขอบให้
