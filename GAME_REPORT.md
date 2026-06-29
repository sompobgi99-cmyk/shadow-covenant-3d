# Shadow Covenant 3D — รายงานข้อมูลเกม

อัปเดต: 2026-06-20 · ไฟล์หลัก: `game-3d/index.html` (single-file, Three.js r128)
แนวเกม: 3D pixel 2.5D survivors-like (อิง Megabonk) · ธีม gothic horror

---

## 1. ภาพรวม / การควบคุม
- เปิดเกม → **หน้า Title** (▶ เริ่มเกม) → **เลือกตัวละคร** → เล่น
- **WASD / ลูกศร** เดิน · **Space** พุ่งหลบ (dash) · **F** โต้ตอบ (แท่น/หีบ/ศาล/พ่อค้า) · **P / Esc** หยุด
- ตาย/ชนะ: **R** เริ่มใหม่ · **C** เลือกตัวละครใหม่
- มุมกล้อง: top-down เอียง ~50°, สมูทแกน Y กันเวียนหัว

## 2. โครงรัน (Core Loop)
- เป้าหมาย: **ฆ่าบอส → เข้าวาป ภายใน 10 นาที** (RUN_TARGET = 600 วิ)
- **แท่นเรียกบอส/วาป** เกิดสุ่มตำแหน่งทุกรอบ (มีลำแสง + HUD ชี้ทาง) กด F เรียกบอสได้ตลอด
- ฆ่าบอส → แท่นเปิดเป็นวาป → เดินเข้า = **VICTORY**
- **Overtime (>10 นาที):** มอนเพิ่มจำนวน (สูงสุด 320) + สปอว์นถี่ขึ้น + ดรอป XP/ทองมากขึ้น (×สูงสุด 3)
- ความยาก: tier 0 (<90วิ) → tier 1 (90–180) → tier 2 (>180), มินิบอสทุก 40 วิ
- สเกลศัตรู `timeScale = min(10, 1+gameTime/130)` (แคปกันเลขล้น)

## 3. ตัวละคร (8 ตัว)
แต่ละตัว: อาวุธประจำตัว + สเตตัสฐาน + passive โตทุกเลเวล · ใส่อาวุธได้สูงสุด **3** (signature + 2)

| ตัวละคร | อาวุธเริ่ม | Passive (ต่อเลเวล) |
|---|---|---|
| Paladin | Void Bolt | +0.4 HP regen |
| Huntress | Hex Spread | +3% attack speed (HP 85, เร็ว) |
| Sorceress | Nova Burst | +4% damage (HP 75) |
| Templar | Orbiting Skull | +6 max HP (HP 140, ช้า, เกราะ 9) |
| Ranger | Hunter's Arrow | +2% move speed (magnet สูง) |
| Necromancer | Soul Spiral | +4% XP gain |
| Slayer | Blade Whirl | +3% damage |
| Priestess | Holy Smite | +0.3 regen & heal (HP 115) |

## 4. อาวุธ (8 ตัว — ทุกตัวมีร่าง evolve แล้ว)
auto-attack · เลเวลสูงสุด 8 · ดาเมจต่อเลเวล +15% × ตัวคูณรวม · ใส่ได้สูงสุด 3 ชิ้น/รัน

| อาวุธ (ตัวละคร) | รูปแบบ | Evolve (Lv8 + tome คู่ ×3) |
|---|---|---|
| Void Bolt (Paladin) | ยิงเป้าใกล้สุด | + Might×3 → **Doom Bolt** |
| Hex Spread (Huntress) | กระจายเป็นพัด | + Multishot×3 → **Hex Storm** |
| Nova Burst (Sorceress) | ระเบิดวง 360° | + Celerity×3 → **Supernova** |
| Orbiting Skull (Templar) | ลูกโคจรรอบตัว | + Precision×3 → **Death Orbit** |
| Hunter's Arrow (Ranger) | ลูกธนูทะลุ ระยะไกล/เร็ว | + Velocity×3 → **Tempest Volley** |
| Holy Smite (Priestess) | ลูกหนักดาเมจสูง ยิงช้า | + Might×3 → **Divine Judgment** |
| Blade Whirl (Slayer) | ใบมีดหมุนรอบตัว ระยะใกล้ เร็ว | + Celerity×3 → **Tempest Blades** |
| Soul Spiral (Necromancer) | ยิงเป็นเกลียวหมุน | + Duration×3 → **Soul Tempest** |

> เก็บอาวุธของตัวอื่นได้ผ่านหน้าเลือกอัปเกรด (ผสมบิลด์ได้) · ครบ 8 ร่าง evolve แล้ว · Orbit สเกล tick เร็วขึ้นตามเลเวล+atk speed

## 5. Tome / Passive (15)
might(+18% dmg), vitality(+25 HP), celerity(+20% atk spd), precision(+25% range), multishot(+1 นัด),
swiftness(+12% move), regen(+0.8/วิ), magnetism(+30% เก็บ), experience(+20% XP), greed(+50% ทอง),
fortitude(+3 เกราะ), lifesteal(+1 HP/คิล), duration(+25% อายุกระสุน), velocity(+20% เร็วกระสุน), growth(+20% ขนาดกระสุน)

## 6. ศัตรู
- **ศัตรูปกติ 28 ชนิด** (3 tier: Bleakfield/Fenmire/Void Rift) — สไปรซ์ 8 ทิศ
- **พฤติกรรม:** chase (ไล่), charger (พุ่ง), shooter (ถอยยิง), exploder (ระเบิดตอนตาย)
- ฝูงมี separation (ไม่ซ้อนกัน), อนิเมชันเดิน, knockback, เอฟเฟกต์ตาย

### มินิบอส (6) — สกิล 2 ต่อตัว (โผล่ทุก 40 วิ)
| ตัว | สกิล |
|---|---|
| Colossus | คลื่นกระแทก · พุ่งชาร์จ |
| Executioner | พุ่งชาร์จ · ฟันพัด |
| Horror | กระจายสุ่ม · วงกระสุน |
| Skeleton Lord | เรียกลูกสมุน · ยิงพัด |
| Troll | ขว้างหิน · ฟื้นเลือด 6% |
| Warden | กางโล่ (ลดดาเมจ 60%/3วิ) · วงกระสุน |

### บอส (5) — สกิล 3 ต่อตัว · โกรธตอนเลือด <50% (สกิลเร็วขึ้น +เดินเร็ว)
| บอส | สกิล |
|---|---|
| Lich King | วงกระสุน · ยิงพัด · เรียกลูกสมุน |
| Abyssal Behemoth | วงใหญ่ · คลื่นกระแทก · พุ่งชาร์จ |
| Soul Reaper | เกลียวคู่ · ยิงพัด · กระจายสุ่ม |
| Void Wyrm | วงใหญ่ · ลูกไฟหนัก · พุ่งชาร์จ |
| **THE OVERLORD** (สุดท้าย, ยักษ์) | เกลียวคู่ · วงใหญ่ · เรียกลูกสมุน 3 (เจอตอน overtime) |

## 7. เศรษฐกิจ / สำรวจแมพ (กด F)
- **หีบ 3 ระดับ** (common/rare/epic) เปิดด้วยทอง ราคาฐาน [40/100/220] ×1.18 ทุกใบที่เปิด → ได้เลือกอัปเกรด 1/2/3 ใบ
- **ศาลเจ้า** (×3) กดฟรี → เรียก elite pack (6 ตัว HP×3, ดรอป×3)
- **พ่อค้าเร่** เดินไปเปิดร้าน (เกมหยุด) ซื้ออาวุธ/passive/ฮีลด้วยทอง
- **ขอบแมพ** เป็นวงหิน/กำแพงพังกั้น

## 8. เอฟเฟกต์ (เทคนิค)
Three.js เรขาคณิตล้วน (ไม่มี shader/particle engine):
- กระสุน/ระเบิด/ประกาย = SphereGeometry + MeshBasicMaterial **additive blending** (เรืองแสง)
- **วงแหวนกระแทกขยาย** (RingGeometry) สำหรับ shock/บอสตาย
- **กล้องสั่น** ตอนโดนตี/บอสออกท่า · แฟลชเปลี่ยนสีตอนโดน · เงา dash (afterimage)
- พื้น: heightmap + แสงเงาเบค · ฟ้าไล่เฉดพลบ + หมอกม่วง · vignette (CSS)

## 9. Knockback
กระเด็นตามความแรงดาเมจ: `kb = min(16, dmg×0.16 / ขนาดศัตรู)` (ลูกโคจรผลักออกจากลูก) — ตีแรงกระเด็นไกล, ตัวใหญ่/บอสกระเด็นน้อย

## 10. ค่าตั้งหลัก (Tunables)
PLAYER_SPEED 4.6 · DASH 26/0.18วิ/คูล 2.2 · MAP_BOUND 56 · maxEnemies cap ไล่ตามเวลา (→320 overtime) ·
miniboss ทุก 55วิ · XP เริ่ม 20 ·
**สเกลศัตรู:** HP = timeScale (สูงสุด ×10) แต่ **ATK = atkTimeScale แยกต่างหาก (สูงสุด ×2.4)** กันวันช็อตเลทเกม
(มินิบอส ×1.15, บอส ×1.3 ของ atkTimeScale)

### Balance update 2026-06-26
- **ATK ศัตรูแยกสเกลจาก HP** — `atkTimeScale()` แคป 2.4 (เดิมใช้ timeScale ×10 → วันช็อต)
- **เกราะ (def) เป็น % mitigation** = `dmg×100/(100+def×5)` (เดิมลบตรงๆ ไร้ผลเลทเกม)
- **รวมระบบดาเมจไว้ที่ `dealEnemyDamage()`** — projectile/nova/orbit/smite/proc วิ่งผ่านจุดเดียว
- **เปิดใช้ไอเทมที่เคยไม่มีผล:** Boss Buster, Brass Knuckles, Beefy Ring, Gamer Goggles, Demonic Soul/Blood,
  Eagle Claw, Credit Card, Idle Juice, Campfire, Energy Core, Soul Harvester, Echo Shard, Wrench,
  + on-hit proc: Dragonfire (burn), Ice Crystal (slow), Thunder Mitts/Spicy Meatball/Power Gloves (AoE), Big Bonk (×20)
- **Perf:** nova/orbit/smite/AoE ใช้ spatial grid, ลด rebuildEnemyGrid/เฟรม, texture loader มี onError กัน 404 ค้าง

## 11. สถานะงาน
**เสร็จ:** Title, เลือกตัวละคร, โครงรัน 10 นาที + แท่น/บอส/วาป + overtime + VICTORY,
อาวุธ+evolution, tome 15, ตัวละคร 8 (สไปรซ์ครบ), ศัตรู 28 + 8 ทิศ, มินิบอส 6 + บอส 5 (สไปรซ์เฉพาะ + สกิล), หีบ/ศาล/พ่อค้า, เอฟเฟกต์เรือง/วงแหวน/กล้องสั่น

**ยังไม่ทำ (ตัวเลือก):** เสียง/เพลง, telegraph เลเซอร์ก่อนบอสยิง, ตัวเลขดาเมจเด้ง, meta-progression ข้ามรัน, เนินสไลด์/กระโดด, บาลานซ์ละเอียดจากการเทสต์จริง

## 12. หมายเหตุเทคนิค
- ไฟล์ index.html อยู่บน Windows mount ที่**เคยถูกตัดท้ายตอนเขียน** — แก้ทุกครั้งควรเช็คว่ามี `</html>` ปิดครบ
- สไปรซ์ทั้งหมดอยู่ใน `assets/sprites/` · สไปรซ์ฉาก/หีบ/ศาล/พ่อค้าวาดเอง (PIL), ตัวละคร/ศัตรู/บอสจาก PixelLab
- ไฟล์ prompt สำหรับ gen เพิ่ม: `PIXELLAB_*_PROMPTS.md`, `CLAUDE_CODE_*.md`, ดีไซน์: `DESIGN.md`
