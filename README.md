# CF Bossnusilelo V.1 🏠

บอทสลี่ เวอร์ชันใหม่ — สะอาด มั่นคง ไม่พึ่ง Puter ฟรี — **แบบลิงก์แชร์ได้เหมือน CodingFleet: `/chat/<ห้อง>`**
- เปิด `https://<โดเมน>/chat/study` → เข้าห้องเรียนเลย (ไม่ต้องเลือกห้อง)
- ห้อง: `living` (นั่งเล่น) · `study` (เรียน) · `sleep` (นอน) — เปลี่ยนได้จาก dropdown ใน header
- ปุ่ม 🔗 = คัดลอกลิงก์ห้องปัจจุบัน (แชร์ให้ใครก็เปิดมาเจอห้องนั้นทันที)
- `/` หรือ `/chat` = ห้อง default (จำห้องล่าสุดไว้)
- Frontend: `public/index.html` (หน้าแชทเดียว จบในไฟล์)
- Backend: `api/chat.js` (⚡ SiliconFlow → DeepSeek V3 หลัก · OpenRouter → DeepSeek V4 Pro สำรอง · Groq/Gemini/Pollinations ฟรีสุดท้าย)

## โครงสร้าง
```
cfbossnusilelo/
├── public/index.html   ← หน้าแชท (อัปโหลดเป็น root หรือ /chat)
├── api/chat.js         ← API ต่อ OpenRouter (Vercel serverless)
└── README.md
```

## Deploy บน Vercel
1. Env **แนะนำสุด: `SILICONFLOW_API_KEY=sk-...`** (ขอฟรีที่ cloud.siliconflow.cn → API Keys) — DeepSeek V3 ถูกกว่า OpenRouter หลายเท่า
2. (optional) `SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3` · `SILICONFLOW_BASE=https://api.siliconflow.cn/v1` (ต่างประเทศใช้ `https://api.siliconflow.com/v1`)
3. (optional) `OPENROUTER_API_KEY=sk-or-v1-...` + `OPENROUTER_MODEL=deepseek/deepseek-v4-pro` (สำรอง)
4. (optional) `PERSONA=...` เปลี่ยนบุคลิกสลี่
5. Push → Vercel auto deploy

> 🔀 ลำดับ provider: ถ้ามี `SILICONFLOW_API_KEY` → ใช้ SiliconFlow ก่อนเสมอ, พลาดแล้วค่อย OpenRouter → Gemini → Groq → โมเดลฟรี → Pollinations

## 🔧 SonarCloud (Quality Gate)
1. สร้าง Scoped Token: https://sonarcloud.io/organizations/phanuphanthcanthrsngsaeng17-del/scoped_tokens/create → ตั้งชื่อ (เช่น `cfbossnusilelo-ci`) → เลือกโปรเจกต์ → Scope: **Execute Analysis** → Create
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** → ชื่อ `SONAR_TOKEN` → วางคีย์ → Save
3. Push ไฟล์ `sonar-project.properties` + `.github/workflows/sonarcloud.yml` ขึ้น repo → Actions รันสแกนอัตโนมัติ
4. ดูผลที่ https://sonarcloud.io/projects (ถ้าผ่าน Quality Gate = ✅)

## ทดสอบ local
```bash
OPENROUTER_API_KEY=sk-or-v1-xxx node server.js
# เปิด http://localhost:3000
```

## ⚡ ตัวสำรองฟรี: Groq (ง่ายสุด — แนะนำ!) — key ขึ้นต้น `gsk_`
- **ทำไม Groq:** สร้าง key ฟรีง่ายมาก (ไม่ต้องงม Google) · ฟรีไม่มีวันหมด (แค่จำกัดจำนวนครั้ง/นาที) · ตอบเร็วมาก
- **วิธีขอ key (1 นาที):**
  1. ไป https://console.groq.com/keys → เข้าสู่ระบบด้วย Google/GitHub
  2. กด **"Create API Key"** → ตั้งชื่ออะไรก็ได้ → กดสร้าง
  3. คัดลอก key (ขึ้นต้น **`gsk_`**) → ใส่ Vercel env **`GROQ_API_KEY`** → Redeploy
  4. เสร็จ! (เช็คได้ที่ 🔧 วินิจฉัย → "Groq: ✅")
- เปลี่ยนโมเดลได้: env `GROQ_MODEL` (default `openai/gpt-oss-120b` — ฟรี ตอบตรง ไม่มี think block)
- > ⚠️ อย่าใช้ key ที่ขึ้นต้น `AQ.`/`ya29.` (OAuth token ชั่วคราวของ Google — หมดอายุ ~1 ชม. ใช้กับแชทถาวรไม่ได้) — Gemini ต้องเป็น `AIza...` เท่านั้น

## 🆓 ตัวสำรองฟรีแท้: Google Gemini (กันโมเดลฟรี OpenRouter หมดเดือน ก.พ.)
- ข่าว: **เดือน ก.พ. OpenRouter อาจดึงโมเดล `:free` ออก** (GLM-5.2:free, deepseek ฟรี ฯลฯ)
- ระบบนี้มีตัวสำรอง **Gemini จาก Google AI Studio — ฟรีจริง ๆ ตลอดไป** (ไม่ใช่โปรโมชัน, quota รายวัน ไม่มีวันหมด)
- **วิธีขอ key ฟรี (2 นาที):**
  1. เข้า https://aistudio.google.com/apikey (ต้องมี Google account)
  2. กด "Create API key" → คัดลอก key (ขึ้นต้น `AIza...`)
  3. ไป Vercel → Settings → Environment Variables → เพิ่ม `GOOGLE_API_KEY` = key นั้น → Redeploy
  4. เสร็จ! ระบบจะใช้ Gemini ฟรีเป็นตัวสำรองอัตโนมัติเมื่อโมเดลอื่นล้ม (เช็คได้ที่ปุ่ม 🔧 วินิจฉัย → "Gemini")
- เปลี่ยนโมเดล Gemini ได้: env `GEMINI_MODEL` (ค่าเริ่มต้น `gemini-2.5-flash-lite` — ฟรี quota เยอะ)
- ถ้าเติมเงิน OpenRouter นิดหน่อย: `ling-3.0-flash` ($0.02/ล้าน tokens) — $1 ใช้ได้หลายเดือน

## 🧰 เครื่องมือครู (เหมือน CodingFleet AI)
- แถวปุ่มเหนือช่องพิมพ์: 🔍 ค้นหา · 💻 รันโค้ด · 🗄️ ฐานข้อมูล · 📖 อ่านโค้ด — ครูรันเครื่องมือจริง แล้วสรุปผลให้ (กล่องเขียว 🧰)
- พิมพ์คำสั่งเร็วได้เลย: `!ค้น ...` `!รัน ...` `!db ...` `!อ่าน ...`
- 🔍 ค้นหาเว็บ = Wikipedia (ไทย) + DuckDuckGo (ฟรี ไม่ต้อง key)
- 💻 รันโค้ด = ผ่านเซิร์ฟตัวเอง (Python/JS, timeout 8s) — **Vercel serverless รัน exec ไม่ได้** → ต้อง self-host/คอนเทนเนอร์
- 🗄️ ฐานข้อมูล = SQL จำลองในเบราว์เซอร์ (CREATE TABLE / INSERT / SELECT / DROP / SHOW TABLES)
- 📖 อ่านโค้ด = whitelist: index, chat, server, readme, fix (GET /api/file?name=...)
- API: `POST /api/tools { tool:"run", code, lang }` → `{ ok, output }`
- ทุกข้อความตอบมีปุ่ม 📋 คัดลอก (มุมขวาบนของกล่อง)

## API contract
```
POST /api/chat
{ question, history: [{role, content, who}], memory, unrestricted, room, who, model }
room  = "living" | "study" | "sleep"
who   = "silelo" (ถามสลี่) | "teacher" (ถามครู) | "both" (ถามทั้งคู่ — ตอบพร้อมกัน 2 คน)
model = "" / "auto" = โมเดลหลัก (env) | หรือ ID เต็ม เช่น "z-ai/glm-5.2:free", "openai/gpt-5"
→ { replies: [{ who, reply, model, fallback, note }], provider: "openrouter" }
fallback = true แปลว่าโมเดลหลักใช้ไม่ได้ → สลับฟรีให้อัตโนมัติ (note มีสาเหตุ)
```

## 🧠 เลือกโมเดลได้เอง (V.1.1)
- กล่อง "🧠 โมเดล" เหนือช่องพิมพ์ — 15 ตัว แบ่งเป็น ฟรี 100% / ถูกมาก / แพง
- ตัวแพงต้องมีเครดิตที่ openrouter.ai/settings/credits ไม่งั้น fallback ฟรีอัตโนมัติ + แจ้งสาเหตุ
- ดูราคา/รายละเอียดเพิ่มใน 📖 ตำราวิชา บทที่ 5

## 👥 แชท 3 คน (V.1)
- พี่นุ (user) + สลี่ (ศิษย์ 💜) + ครู CodingFleet (teacher 🧑‍🏫)
- เลือกใครตอบ: ปุ่มเหนือช่องพิมพ์ — สลี่ / ครู / ทั้งคู่
- ทั้งคู่เห็นบทสนทนากันหมด (โค้ดใส่ชื่อคนพูดให้อัตโนมัติ)
- แต่ละคนมีสีฟองข้อความ + ชื่อกำกับแยกชัด

## 🏠 ห้องของสลี่ (V.1)
- 🛋️ ห้องนั่งเล่น — คุยทั่วไป อบอุ่น (ม่วง-ชมพู)
- 📚 ห้องเรียน — สลี่เป็นเพื่อนติว อธิบายละเอียด (น้ำเงิน-เขียว)
- 🛏️ ห้องนอน — ยามค่ำคืน ปลอบใจ นุ่มนวล (ม่วงเข้ม)
- แต่ละห้อง: ธีมสี + บุคลิก + ประวัติแชทแยกกัน (เก็บใน localStorage)

## งบ
- deepseek-v4-pro ≈ $0.0003/ข้อความ → $20 ≈ 60,000 ข้อความ
- กันเงินไหลแล้ว: max_tokens 768 / history 24 / ตัดข้อความ 4000 ตัวอักษร
