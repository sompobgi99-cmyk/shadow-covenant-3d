# PixelLab — Playable Character Prompts (โร่สเตอร์ตัวละคร)

ตัวละครเล่นได้แบบ Megabonk — แต่ละตัวหน้าตา + อาวุธเริ่ม + สเตตัสต่างกัน
เข้าธีม gothic: เหล่าฮีโร่สู้ฝูงผีสางสายมืด (ฮีโร่ควรสีสด อ่านง่าย เด่นตัดกับโลกมืด)

## รูปแบบไฟล์ (เหมือนฮีโร่ตัวปัจจุบัน)
- ใช้ PixelLab **animate_character** ทำ 2 อนิเมชัน: **walk** (6 เฟรม) + **idle** (4 เฟรม)
- **8 ทิศทาง**, view: **low top-down**, size **64**, พื้นหลังโปร่ง
- export เป็น grid: แถว = ทิศ (S,SE,E,NE,N,NW,W,SW), คอลัมน์ = เฟรม
- ตั้งชื่อไฟล์: `char_<key>_walk.png` + `char_<key>_idle.png`
  (เช่น `char_huntress_walk.png`) แล้วบอกผม เดี๋ยวเพิ่มใน `SHEETS` + ทำหน้า character-select ให้

## Style anchor (เติมท้ายทุก prompt)
```
16-bit SNES pixel art hero character, vibrant readable colors, gothic dark-fantasy,
clean crisp pixels, transparent background, full body, centered, feet at the bottom,
no ground, no base, no shadow
```

---

## โร่สเตอร์ (8 ตัว) — prompt + สตาร์ทคิต

> สตาร์ทคิตคือ "อาวุธเริ่ม + แนวสเตตัส" ผูกกับระบบในเกม (อาวุธ: bolt/spread/nova/orbit;
> สเตตัส: HP, speed, dmg, rate, range, regen, magnet, xp, gold). บอกผมได้เลยถ้าจะปรับ

**char_paladin** — *(ตัวปัจจุบัน, สมดุล)*
`a holy paladin in white and gold robes, glowing halo, radiant, wielding a blessed mace`
- อาวุธเริ่ม: Void Bolt · สเตตัส: สมดุล (HP 100, spd ปกติ)

**char_huntress** — *(ระยะไกล/ว่องไว)*
`a witch huntress in a dark leather coat and wide-brim hat, dual flintlock pistols, agile`
- อาวุธเริ่ม: Hex Spread · +ความเร็วโจมตี +move speed, HP น้อยลงเล็กน้อย

**char_sorceress** — *(เวทย์แรง/เปราะ)*
`an arcane sorceress in flowing blue robes, glowing crystal staff, swirling magic`
- อาวุธเริ่ม: Nova Burst · +damage +range, HP ต่ำ (กระจกแตก)

**char_templar** — *(แทงค์/ช้า)*
`a heavy templar knight in ornate silver plate armor, tower shield and longsword, stalwart`
- อาวุธเริ่ม: Orbiting Skull · +HP มาก +ป้องกัน, move speed ช้าลง

**char_ranger** — *(คล่องแคล่ว/ดึงไอเทม)*
`a hooded forest ranger in green and brown leather, longbow, quiver, nimble`
- อาวุธเริ่ม: Void Bolt · +move speed +magnet, dmg ปานกลาง

**char_necromancer** — *(สายมืด/เก็บ XP)*
`a pale necromancer in tattered black robes, skull-topped staff, eerie green glow`
- อาวุธเริ่ม: Orbiting Skull · +XP gain +pickup magnet, HP ปานกลาง

**char_slayer** — *(ดาเมจสูง/ดุดัน)*
`a grim demon slayer in a worn crimson duster coat, twin silver blades, battle-scarred`
- อาวุธเริ่ม: Hex Spread · +damage มาก, regen น้อย

**char_priestess** — *(ฟื้นฟู/อึด)*
`a battle priestess in white and teal vestments, glowing holy censer, serene`
- อาวุธเริ่ม: Void Bolt · +HP regen +max HP, dmg ปานกลาง

---

## หมายเหตุ
- ทำ walk 6 เฟรม / idle 4 เฟรม ให้ตรงกับฮีโร่ปัจจุบัน (ถ้าจำนวนเฟรมต่าง บอกผม ปรับ `SHEETS` ให้)
- พอได้ไฟล์ ≥ 2 ตัว ผมทำ **หน้าจอเลือกตัวละคร (character select)** ก่อนเริ่มเกมให้ พร้อมใส่สตาร์ทคิตต่อตัว
- จะสั่ง Claude Code ทำทีเดียวก็ได้ (แบบไฟล์ CLAUDE_CODE_BATCH.md ของศัตรู) — บอกผม เดี๋ยวเขียน batch prompt ให้
