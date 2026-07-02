# Supabase Google Login + Verified Ranking

ระบบนี้ยังเล่นแบบ Guest ได้เหมือนเดิม แต่ถ้าผู้เล่นกด Google Login ก่อนเริ่มรัน คะแนนที่ส่งขึ้น Online Ranking จะถูกตรวจ token กับ Supabase Auth แล้วติดสถานะ `verified` และ Achievement/Unlock จะ sync ตาม Google user

> เวอร์ชันนี้ยังเก็บคะแนนและ progress ด้วย Netlify Blobs เหมือนเดิม เพื่อไม่ต้องย้ายฐานข้อมูลทันที Supabase ใช้สำหรับ Login และยืนยัน `user_id`

## สิ่งที่โค้ดทำไว้แล้ว

- หน้าแรกมีแถบ `Guest / Verified` และปุ่ม `Google Login`
- `js/auth.js` โหลด config จาก `/api/auth-config`
- `/api/auth-config` อ่านค่า `SUPABASE_URL` และ `SUPABASE_ANON_KEY` จาก Netlify env
- ตอนส่งคะแนน `js/online-leaderboard.js` แนบ `Authorization: Bearer <access_token>` ถ้าผู้เล่น login อยู่
- `netlify/functions/leaderboard.mts` ตรวจ token กับ Supabase Auth endpoint ก่อนบันทึกเป็น verified
- Public leaderboard ไม่ส่ง `user_id` กลับไปหน้าเว็บ แสดงแค่ badge `ID`
- `/api/player-progress` เก็บ Achievement/Unlock โดยผูกกับ Supabase `user_id`
- Guest ยังเก็บ unlock ใน `localStorage`; เมื่อ Login ระบบจะ merge local + cloud และไม่ลบของเดิม

## 1) สร้าง Supabase project

1. เข้า https://supabase.com/dashboard
2. New project
3. ไปที่ Project Settings > API
4. จดค่า:
   - Project URL = `SUPABASE_URL`
   - anon public key = `SUPABASE_ANON_KEY`

ห้ามใช้ `service_role key` ในหน้าเว็บหรือ Netlify env ชุดนี้

## 2) ตั้งค่า URL ใน Supabase Auth

ไปที่ Authentication > URL Configuration

ตั้งค่า:

```text
Site URL:
https://shadow-covenant-3d.netlify.app
```

เพิ่ม Redirect URLs:

```text
https://shadow-covenant-3d.netlify.app/**
http://localhost:8888/**
http://localhost:8090/**
```

ถ้าจะใช้ Netlify deploy preview ให้เพิ่ม:

```text
https://**--shadow-covenant-3d.netlify.app/**
```

## 3) สร้าง Google OAuth client

ไปที่ Google Cloud Console > APIs & Services > Credentials

1. Create Credentials > OAuth client ID
2. Application type: Web application
3. Authorized JavaScript origins:

```text
https://shadow-covenant-3d.netlify.app
http://localhost:8888
http://localhost:8090
```

4. Authorized redirect URIs:

ใช้ callback URL จาก Supabase หน้า Authentication > Providers > Google

หน้าตาจะประมาณนี้:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

5. กด Create แล้วเก็บ:
   - Client ID
   - Client Secret

## 4) เปิด Google Provider ใน Supabase

ไปที่ Authentication > Providers > Google

1. เปิด Enable
2. ใส่ Google Client ID
3. ใส่ Google Client Secret
4. Save

Scope พื้นฐานที่ต้องมีคือ `openid`, `email`, `profile`

## 5) ตั้งค่า Netlify Environment Variables

ไปที่ Netlify > Site configuration > Environment variables

เพิ่ม:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

จากนั้น Redeploy site

## 6) ทดสอบบนเครื่อง

สร้างไฟล์ `.env` ที่ root project:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

รัน:

```powershell
npx netlify dev
```

เปิด URL ที่ Netlify CLI แสดง ปกติคือ:

```text
http://localhost:8888
```

ทดสอบ:

1. หน้าแรกต้องเห็นปุ่ม Google Login
2. กด Login แล้วเลือกบัญชี Google
3. กลับมาหน้าเกมต้องขึ้น `Verified <ชื่อ>`
4. เล่นจนจบ/ตาย
5. Run Summary ต้องขึ้น `Online verified`
6. Online Ranking ต้องมี badge `ID`
7. ไปที่ Guide > Achievements ต้องเห็นสถานะ `Google: sync unlock แล้ว`

ถ้าเปิดด้วย `python -m http.server 8090` เกมยังเล่นได้ แต่ `/api/auth-config` จะไม่ทำงาน เพราะไม่ได้ผ่าน Netlify Functions

## 7) ปัญหาที่พบบ่อย

### กด Login แล้ว redirect error

เช็ก 3 จุด:

- Supabase Redirect URLs มี URL ที่เปิดเกมอยู่จริง
- Google Authorized JavaScript origins มี origin เดียวกัน
- Google Authorized redirect URI ใช้ Supabase callback URL ไม่ใช่ URL เกม

### หน้าเกมขึ้น Guest ตลอด

เช็ก:

- Netlify env มี `SUPABASE_URL` และ `SUPABASE_ANON_KEY`
- Deploy ใหม่หลังใส่ env แล้ว
- เปิดผ่าน Netlify URL หรือ `npx netlify dev`

### เล่นจบแล้ว Online failed

เช็ก:

- token หมดอายุหรือ logout ไปแล้ว
- function `/api/leaderboard` เห็น env Supabase ครบ
- build version ในเกมตรงกับ `REQUIRED_BUILD`

### คะแนนขึ้นแต่ไม่มี ID

แปลว่าส่งคะแนนแบบ Guest สำเร็จ แต่ตอนจบรันไม่ได้มี session login อยู่ ให้ login ก่อนเริ่มรันใหม่

### Login แล้ว unlock ไม่ตามมา

เช็ก:

- เปิดผ่าน Netlify URL หรือ `npx netlify dev` ไม่ใช่ `python -m http.server`
- function `/api/player-progress` ไม่ควรตอบ 404
- session Google ยังไม่หมดอายุ
- ถ้าเล่นแบบ Guest มาก่อน ให้ Login หนึ่งครั้ง ระบบจะ merge unlock จากเครื่องนี้ขึ้น cloud อัตโนมัติ
