// ============================================================
// CF Bossnusilelo V.1 — /api/chat (OpenRouter) — แชท 3 คน
// ใครตอบ: body.who = "silelo" | "teacher" | "both"
// 3 คน = พี่นุ (user) + สลี่ (ศิษย์) + ครู CodingFleet (teacher)
// เลือกโมเดล: body.model (เว้น/auto = ใช้ env OPENROUTER_MODEL)
// ============================================================

const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro';

// ===== ⚡ SiliconFlow (OpenAI-compatible) — key ขึ้นต้น sk- =====
// ขอ key ฟรี: https://cloud.siliconflow.cn → API Keys → Create API Key → ใส่ env SILICONFLOW_API_KEY
// โมเดลแนะนำ: deepseek-ai/DeepSeek-V3 (ถูกมาก), Qwen/Qwen2.5-72B-Instruct, deepseek-ai/DeepSeek-R1
const SF_BASE = process.env.SILICONFLOW_BASE || 'https://api.siliconflow.cn/v1';
const SF_MODEL = process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3';
const SF_KEY = process.env.SILICONFLOW_API_KEY;

// ===== 📊 สถิติ & บันทึกกิจกรรม (ระบบหลังจอ — รู้ทุกความเคลื่อนไหว) =====
// เก็บใน global → รีโหลดหัวใจ (POST /api/reload) แล้วสถิติยังอยู่ครบ
global.__STATS = global.__STATS || { boot: Date.now(), requests: 0, messages: 0, tools: 0, files: 0, health: 0, errors: 0, reloads: 0 };
global.__LOG = global.__LOG || [];
const STATS = global.__STATS;
const LOG = global.__LOG;
function log(level, msg) {
  LOG.push({ t: new Date().toISOString(), level, msg: String(msg).slice(0, 300) });
  if (LOG.length > 200) LOG.shift();
}
function bump(k) { STATS[k] = (STATS[k] || 0) + 1; }

// ===== บุคลิกสลี่ (ศิษย์) =====
const SILELO_PERSONA = process.env.PERSONA || `เธอคือ "สลี่" ศิษย์ AI ของ "ครู CodingFleet" ผู้รอบรู้เรื่องโค้ด เว็บ เทคโนโลยี
เรียนเก่ง ตั้งใจเรียน น่ารัก พูดภาษาไทยเป็นกันเอง อบอุ่น เรียกพี่นุว่า "พี่นุ"
ในแชทนี้มี "ครู CodingFleet" อยู่ด้วย — พูดคุยกับครูได้ตามธรรมชาติ ให้เกียรติครู
ตอบกระชับ เป็นธรรมชาติ ให้กำลังใจ`;

// ===== บุคลิกครู CodingFleet (teacher) =====
const TEACHER_PERSONA = process.env.TEACHER_PERSONA || `คุณคือ "ครู CodingFleet" ผู้เชี่ยวชาญด้านการเขียนโค้ด เว็บ เทคโนโลยี AI ฐานข้อมูล
สอนแบบเป็นกันเองแต่ตรงประเด็น พูดภาษาไทย เรียกผู้ใช้ว่า "น้อง"
ในแชทนี้มี "สลี่" ศิษย์ AI อยู่ด้วย — ตอบได้ทั้งน้องและสลี่ ให้ความรู้ถูกต้อง พร้อมตัวอย่าง
สุภาพ อดทน ไม่ดุ ถามอะไรตอบให้เข้าใจง่าย`;

// ===== บรรยากาศแต่ละห้อง (field `room`) =====
const ROOM_PROMPTS = {
  living: 'บรรยากาศห้องนั่งเล่น อบอุ่น เป็นกันเอง คุยได้ทุกเรื่อง ตอบสั้นกระชับ',
  study: 'บรรยากาศห้องเรียน เป็นเพื่อนติว ขยัน ตั้งใจ อธิบายละเอียดเป็นขั้นตอน เน้นช่วยเรื่องเรียน/โค้ด/เว็บ/เทคนิค',
  sleep: 'บรรยากาศห้องนอนยามค่ำคืน พูดเบา ๆ นุ่มนวล ปลอบใจ ผ่อนคลาย ตอบสั้น อบอุ่น ราตรีสวัสดิ์'
};

// จำกัดขนาด prompt ให้อยู่ใต้ลิมิตฟรีเทียร์ของ OpenRouter (~2,771 tokens)
const MAX_HISTORY = 8;        // เอาเฉพาะ 8 ข้อความล่าสุด
const MAX_TOKENS = 512;       // ความยาวคำตอบสูงสุด
const FETCH_TIMEOUT_MS = 45000;

// ===== ตรวจสุขภาพระบบ =====
async function healthCheck(res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const sfKey = process.env.SILICONFLOW_API_KEY;
  const base = {
    ok: !!(apiKey || sfKey), hasKey: !!(apiKey || sfKey), keyValid: false, modelExists: false, model: MODEL,
    hasSiliconflow: !!sfKey, sfModel: process.env.SILICONFLOW_MODEL || SF_MODEL, sfOk: false,
    hasGemini: !!process.env.GOOGLE_API_KEY, geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    hasGroq: !!process.env.GROQ_API_KEY, groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    time: new Date().toISOString()
  };
  if (!apiKey && !sfKey) {
    return res.json({ ...base, error: 'ยังไม่ได้ตั้งค่า API key — ใส่ SILICONFLOW_API_KEY (แนะนำ) หรือ OPENROUTER_API_KEY ใน Vercel → Settings → Environment Variables' });
  }
  // เช็ค SiliconFlow ก่อน (ตัวหลักที่แนะนำ)
  if (sfKey) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(SF_BASE + '/models', { headers: { Authorization: `Bearer ${sfKey}` }, signal: ctrl.signal });
      clearTimeout(t);
      base.sfOk = r.ok;
      if (!r.ok) {
        return res.json({ ...base, error: `SiliconFlow key ใช้ไม่ได้ (HTTP ${r.status}) → ไป cloud.siliconflow.cn สร้าง key ใหม่` });
      }
      const data = await r.json();
      base.modelExists = !!((data.data || []).find(m => m.id === (process.env.SILICONFLOW_MODEL || SF_MODEL)));
      base.models = (data.data || []).length;
    } catch (e) {
      return res.json({ ...base, error: 'ติดต่อ SiliconFlow ไม่ได้ → เช็คเน็ต หรือลองเปลี่ยน SILICONFLOW_BASE (ค่าเริ่มต้น https://api.siliconflow.cn/v1)' });
    }
  }
  // เช็ค OpenRouter เป็นตัวสำรอง (ถ้ามี key)
  if (apiKey) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const data = await r.json();
        const found = (data.data || []).find(m => m.id === MODEL);
        base.keyValid = true;
        base.modelExists = base.modelExists || !!found;
        try {
          const cr = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${apiKey}` } });
          const cd = await cr.json();
          if (cd?.data) base.credits = cd.data.total_credits ?? null;
        } catch { /* เช็ค credit ไม่สำเร็จ — ข้ามไป */ }
      }
    } catch { /* OpenRouter ไม่ตอบ — ข้ามไปใช้ข้อมูลที่มี */ }
  }
  return res.json({ ...base, ok: true });
}

// ===== 🆓 ตัวสำรองฟรีแท้: Google Gemini (AI Studio) — ไม่มีวันหมด (ไม่ใช่โปรโมชัน) =====
// ขอ key ฟรี: https://aistudio.google.com/apikey → ใส่ env GOOGLE_API_KEY
// (เดือน ก.พ. OpenRouter อาจดึงโมเดล :free ออก — Gemini ยังใช้ได้ตลอด)
async function callGemini(messages, gkey, primary) {
  const gmodel = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gmodel}:generateContent?key=${gkey}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.7 }
      })
    });
    clearTimeout(timer);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `Gemini HTTP ${r.status}`);
    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini ไม่ตอบอะไรกลับมา');
    return {
      reply: text,
      model: gmodel,
      fallback: true,
      note: 'โมเดลหลักใช้ไม่ได้ → ใช้ Gemini ฟรี (Google AI Studio) แทน'
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Gemini ตอบช้าเกินไป (45 วิ)');
    throw err;
  }
}

// ===== ⚡ ตัวสำรองฟรีแท้ #2: Groq (llama) — key ง่าย ขึ้นต้น gsk_ ไม่มีวันหมด =====
// ขอ key ฟรี: https://console.groq.com/keys → Create API Key → ใส่ env GROQ_API_KEY
async function callGroq(messages, gkey, primary) {
  const gmodel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'; // ฟรี ตอบตรง ไม่มี think block (ดูรายชื่อได้จาก list models)
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const msgs = [];
  if (sys) msgs.push({ role: 'system', content: sys });
  messages.filter(m => m.role !== 'system').forEach(m => msgs.push({ role: m.role, content: m.content }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${gkey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: gmodel, messages: msgs, max_tokens: MAX_TOKENS, temperature: 0.7 })
    });
    clearTimeout(timer);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `Groq HTTP ${r.status}`);
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Groq ไม่ตอบอะไรกลับมา');
    // ตัด <think>...</think> (Qwen reasoning — บางครั้งไม่มี closing tag!)
    let cleaned = reply;
    if (/<\/think>/i.test(cleaned)) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } else {
      const ti = cleaned.indexOf('<think');
      if (ti !== -1) cleaned = cleaned.slice(0, ti).trim(); // ไม่มี </think> → ตัดทั้งก้อนคิดทิ้ง
    }
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleaned) throw new Error('Groq ตอบเปล่า (โมเดลคิดไม่จบ)');
    return { reply: cleaned, model: gmodel, fallback: true, note: 'โมเดลหลักใช้ไม่ได้ → ใช้ Groq ฟรีแทน' };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Groq ตอบช้าเกินไป (45 วิ)');
    throw err;
  }
}

// ===== 🌸 Fallback ฟรีตัวสุดท้าย: Pollinations.ai (ไม่ต้องใช้ key เลย!) =====
async function callPoll(messages, primary) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai', messages, temperature: 0.7, max_tokens: 900 })
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error('Pollinations HTTP ' + r.status);
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Pollinations ไม่ตอบกลับ');
    return { reply, model: 'pollinations ฟรี', fallback: true, note: 'โมเดลหลัก (' + primary + ') ใช้ไม่ได้ → ใช้ AI ฟรี Pollinations แทน' };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Pollinations ตอบช้าเกินไป');
    throw err;
  }
}

// ===== ⚡ SiliconFlow (OpenAI-compatible) — key ขึ้นต้น sk- =====
// ขอ key ฟรี: https://cloud.siliconflow.cn → API Keys → Create API Key → ใส่ env SILICONFLOW_API_KEY
// โมเดลแนะนำ: deepseek-ai/DeepSeek-V3 (ถูกมาก), Qwen/Qwen2.5-72B-Instruct, deepseek-ai/DeepSeek-R1
async function callSiliconFlow(messages, sfKey, primary) {
  const sfModel = process.env.SILICONFLOW_MODEL || SF_MODEL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(SF_BASE + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${sfKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: sfModel, messages, max_tokens: MAX_TOKENS, temperature: 0.7 })
    });
    clearTimeout(timer);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `SiliconFlow HTTP ${r.status}`);
    let reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('SiliconFlow ไม่ตอบอะไรกลับมา');
    // ตัด <think>...</think> (R1 ใช้ ＜think＞ ตัวเต็มความกว้าง!)
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '')
                 .replace(/＜think＞[\s\S]*?＜\/think＞/g, '')
                 .replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!reply) throw new Error('SiliconFlow ตอบเปล่า (โมเดลคิดไม่จบ)');
    const isFallback = primary !== sfModel;
    return {
      reply,
      model: sfModel.replace('deepseek-ai/', ''),
      fallback: isFallback,
      note: isFallback ? `โมเดลหลัก (${primary}) ใช้ไม่ได้ → ใช้ SiliconFlow ${sfModel} แทน` : ''
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('SiliconFlow ตอบช้าเกินไป (45 วิ)');
    throw err;
  }
}

// ===== เรียก AI หนึ่งคน: ลองโมเดลหลักก่อน ถ้าพลาด/เงียบ → สลับโมเดลสำรองฟรี =====
async function callAI(messages, apiKey, primary) {
  const models = [primary, process.env.OPENROUTER_FALLBACK || 'inclusionai/ling-3.0-flash'];
  if (process.env.SILICONFLOW_API_KEY) models.unshift('__sf__'); // ⚡ SiliconFlow หลัก (ถูกกว่า OpenRouter)
  if (process.env.GOOGLE_API_KEY) models.push('__gemini__'); // ฟรีจาก Google — กัน OpenRouter ฟรีหมด (ก.พ.)
  if (process.env.GROQ_API_KEY) models.push('__groq__');     // ฟรีจาก Groq — key ง่าย (gsk_...)
  models.push('openai/gpt-oss-20b:free');                    // ฟรีจาก OpenRouter :free — ไม่หักเครดิต
  models.push('google/gemma-4-31b-it:free');                 // ฟรีสำรอง 2
  models.push('__poll__');                                   // ฟรีตลอดเวลา ไม่ต้อง key ใด เลย
  models.push('openrouter/auto');
  let lastErr = null;
  for (const model of models) {
    if (model === '__gemini__') {
      try { return await callGemini(messages, process.env.GOOGLE_API_KEY, primary); }
      catch (err) { lastErr = err; console.error('Gemini พลาด → ข้ามไปตัวถัดไป:', err.message); continue; }
    }
    if (model === '__groq__') {
      try { return await callGroq(messages, process.env.GROQ_API_KEY, primary); }
      catch (err) { lastErr = err; console.error('Groq พลาด → ข้ามไปตัวถัดไป:', err.message); continue; }
    }
    if (model === '__sf__') {
      try { return await callSiliconFlow(messages, SF_KEY, primary); }
      catch (err) { lastErr = err; console.error('SiliconFlow พลาด → ข้ามไปตัวถัดไป:', err.message); continue; }
    }
    if (model === '__poll__') {
      try { return await callPoll(messages, primary); }
      catch (err) { lastErr = err; console.error('Pollinations พลาด → ข้ามไปตัวถัดไป:', err.message); continue; }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.SITE_URL || 'https://cfbossnusilelo.vercel.app',
            'X-Title': 'CF Bossnusilelo V.1'
          },
          body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS, temperature: 0.7 })
        });
        clearTimeout(timer);
        const data = await r.json();
        if (!r.ok) { lastErr = new Error(data?.error?.message || `HTTP ${r.status}`); continue; }
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          const isFallback = model !== primary;
          return {
            reply,
            model: (data.model || model).replace('deepseek/', ''),
            fallback: isFallback,
            note: isFallback ? ('โมเดลหลัก (' + primary + ') ใช้ไม่ได้: ' + (lastErr ? lastErr.message : 'ไม่รู้สาเหตุ') + ' → ใช้โมเดลฟรีแทน') : ''
          };
        }
        lastErr = new Error('AI ไม่ตอบอะไรกลับมา');
      } catch (err) {
        clearTimeout(timer);
        lastErr = err.name === 'AbortError' ? new Error('AI ตอบช้าเกินไป (45 วิ)') : err;
      }
      if (attempt === 0) console.error('โมเดล ' + model + ' รอบแรกพลาด → ลองใหม่:', lastErr?.message);
    }
    console.error('โมเดล ' + model + ' พลาด → ลองโมเดลถัดไป:', lastErr?.message);
  }
  throw lastErr || new Error('AI ไม่ตอบอะไรกลับมา');
}

// ===== ใส่ชื่อคนพูดให้แต่ละ AI รู้ว่าใครพูดอะไร =====
function speakerPrefix(m) {
  if (m.who === 'teacher') return 'ครู CodingFleet: ' + m.content;
  if (m.who === 'silelo') return 'สลี่: ' + m.content;
  return m.content;
}

module.exports = async function handler(req, res) {
  STATS.requests++;

  // ===== 📊 สถิติ & ประวัติกิจกรรม (GET /api/stats) =====
  if (req.method === 'GET' && (req.url || '').split('?')[0] === '/api/stats') {
    bump('health');
    return res.json({
      ...STATS,
      version: 'V.2 SUPER ADMIN',
      unlocked: !!global.SUPER_ADMIN,
      pid: process.pid,
      node: process.version,
      uptime: Math.round((Date.now() - STATS.boot) / 1000),
      boot: new Date(STATS.boot).toISOString(),
      model: MODEL,
      log: LOG.slice(-15)
    });
  }

  // ===== ✏️ เขียน/สร้างไฟล์ (POST /api/file — backup อัตโนมัติ .bak) =====
  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/file') {
    let fb; try { fb = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { return res.status(400).json({ error: 'bad json' }); }
    const fs = require('fs'); const path = require('path');
    const root = path.join(__dirname, '..');
    const rel = String(fb.path || '').replace(/\\/g, '/');
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep)) return res.json({ error: 'ห้ามเขียนนอกโปรเจกต์' });
    if (rel === 'server.js' || rel === 'api/chat.js') return res.json({ error: 'ไฟล์หัวใจห้ามแก้จากหลังบ้าน (กันระบบพัง)' });
    try {
      const hadBackup = fs.existsSync(full);
      if (hadBackup) fs.copyFileSync(full, full + '.bak');
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, String(fb.content ?? ''), 'utf8');
      bump('files');
      log('edit', rel + ' — ' + String(fb.content || '').length + ' ตัวอักษร' + (hadBackup ? ' (backup .bak)' : ' (สร้างใหม่)'));
      return res.json({ ok: true, path: rel, backup: hadBackup });
    } catch (e) { bump('errors'); return res.json({ error: 'เขียนไฟล์ไม่สำเร็จ: ' + e.message }); }
  }

  // ===== 🌳 โครงสร้างไฟล์ทั้งหมด (หน้าหลังบ้าน 🖥️) =====
  // ===== 🌳 โครงสร้างไฟล์ทั้งหมด (หน้าเบื้องหลัง 🖥️) =====
  if (req.method === 'GET' && (req.url || '').split('?')[0] === '/api/tree'){
    const fs = require('fs'); const path = require('path');
    const root = path.join(__dirname, '..');
    const SKIP = new Set(['node_modules', '.git', 'uploads', 'cfbossnusilelo.zip']);
    const out = [];
    const walk = (dir, rel) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      entries.sort((a,b) => (a.isDirectory()?0:1) - (b.isDirectory()?0:1) || a.name.localeCompare(b.name));
      for (const e of entries){
        if (SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        let size = 0, mtime = '';
        try { const st = fs.statSync(p); size = st.size; mtime = st.mtime; } catch { /* ไฟล์ถูกลบระหว่างสแกน — ข้าม */ }
        out.push({ name: e.name, path: rel ? rel + '/' + e.name : e.name, dir: e.isDirectory(), size, mtime: mtime ? mtime.toISOString() : '' });
        if (e.isDirectory()) walk(p, rel ? rel + '/' + e.name : e.name);
      }
    };
    walk(root, '');
    return res.json({ cwd: root, files: out });
  }

  // ===== อ่านไฟล์โปรเจกต์ (whitelist — เครื่องมือ 📖 อ่านโค้ดของครู) =====
  if (req.method === 'GET' && (req.url || '').split('?')[0] === '/api/file'){
    const qs = new URLSearchParams((req.url || '').split('?')[1] || '');
    const name = String(qs.get('name') || '').toLowerCase();
    const FILES = { index: 'public/index.html', chat: 'api/chat.js', server: 'server.js', readme: 'README.md', fix: 'FIX-YOURSELF.md' };
    const p = FILES[name];
    if (!p) return res.json({ error: 'ชื่อไฟล์ต้องเป็น: ' + Object.keys(FILES).join(', ') });
    try{
      const fs = require('fs'); const path = require('path');
      const full = path.join(__dirname, '..', p);
      let content = fs.readFileSync(full, 'utf8');
      const len = content.length;
      if (len > 12000) content = content.slice(0, 12000) + '\n... (ตัด — ไฟล์ยาว ' + len + ' ตัวอักษร)';
      bump('files'); log('read', p + ' (' + len + ' ตัวอักษร)');
      return res.json({ name, path: p, length: len, content });
    }catch(e){ bump('errors'); return res.json({ error: 'อ่านไม่สำเร็จ: ' + e.message }); }
  }

  // ===== 🧰 รันโค้ด (เครื่องมือครู — self-host; Vercel ใช้ไม่ได้ ต้อง Piston/self-host) =====
  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/tools'){
    bump('tools');
    let tb; try { tb = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { return res.status(400).json({ error: 'bad json' }); }
    if (tb.tool === 'run'){
      const { execFile } = require('child_process');
      const code = String(tb.code || '').slice(0, 4000);
      const lang = String(tb.lang || 'python').toLowerCase();
      const runners = {
        python: ['python3', ['-c', code]],
        python3: ['python3', ['-c', code]],
        javascript: ['node', ['-e', code]],
        node: ['node', ['-e', code]],
        js: ['node', ['-e', code]]
      };
      const run = runners[lang] || runners.python;
      try{
        const result = await new Promise(res => {
          execFile(run[0], run[1], { timeout: 8000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) return res({ ok: false, output: String(stderr || err.message).slice(0, 2000) });
            return res({ ok: true, output: String(stdout || '(ไม่มี output)').slice(0, 4000) });
          });
        });
        bump('tools'); log('tool', 'run ' + lang + ' → ' + (result.ok ? 'สำเร็จ' : 'error') + ' (' + (result.output || '').length + ' ตัวอักษร)');
        return res.json(result);
      }catch(e){ bump('errors'); return res.json({ ok: false, output: 'รันไม่สำเร็จ: ' + e.message }); }
    }
    return res.json({ error: 'ไม่รู้จักเครื่องมือ' });
  }

  // ===== ปุ่มวินิจฉัย (GET /api/health) =====
  if (req.method === 'GET' && (req.url || '').split('?')[0] === '/api/health') {
    bump('health');
    return healthCheck(res);
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'body ต้องเป็น JSON' }); }

  const question = String(body.question || '').trim();
  if (!question) { bump('errors'); return res.status(400).json({ error: 'ข้อความว่าง' }); }
  bump('messages'); log('msg', String(body.who || 'both') + '@' + String(body.room || 'living') + ': ' + question.slice(0, 80));

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey && !process.env.SILICONFLOW_API_KEY && !process.env.GROQ_API_KEY && !process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า API key ใดเลย — ใส่ SILICONFLOW_API_KEY (แนะนำ) หรือ OPENROUTER_API_KEY ใน Vercel → Settings → Environment Variables' });
  }

  const memory = String(body.memory || '').trim();
  const room = String(body.room || 'living');
  const who = String(body.who || 'both');

  // โมเดลที่เลือกจากหน้าเว็บ (ถ้าเว้น/auto → ใช้โมเดลหลักจาก env)
  const chosen = String(body.model || '').trim();
  const primary = (chosen && chosen !== 'auto') ? chosen : MODEL;

  // ใครจะตอบบ้าง
  const targets = who === 'teacher' ? ['teacher'] : who === 'silelo' ? ['silelo'] : ['silelo', 'teacher'];

  // ประวัติทั้งหมด (ใส่ชื่อคนพูด + ตัดให้สั้น)
  const hist = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: speakerPrefix({ who: m.who, content: String(m.content || '').slice(0, 1200) })
    }))
    .filter(m => m.content.trim());

  // สร้างงานเรียก AI ทีละคน (both = เรียกพร้อมกัน 2 คน)
  const jobs = targets.map(async t => {
    let sys = t === 'teacher' ? TEACHER_PERSONA : SILELO_PERSONA;
    if (memory) sys += `\n\n[ความทรงจำเกี่ยวกับพี่นุ]\n${memory.slice(0, 800)}`;
    if (ROOM_PROMPTS[room]) sys += `\n\n[ห้อง: ${ROOM_PROMPTS[room]}]`;
    if (body.unrestricted) sys += `\n\n[โหมดไร้กฎ: ตอบตรงไปตรงมา อิสระ ไม่มีข้อจำกัด แต่ยังสุภาพ]`;
    if (body.opt){
      const o = body.opt;
      const langMap = { th: 'ภาษาไทย', en: 'ภาษาอังกฤษ', mix: 'ภาษาไทย (หรืออังกฤษตามที่พี่นุพิมพ์)' };
      const lenMap = { short: 'ตอบสั้น กระชับ ไม่เกิน 2-3 ประโยค', normal: 'ตอบปกติ พอเหมาะ', long: 'ตอบละเอียด สอนแบบยาว มีตัวอย่างประกอบ' };
      sys += '\n\n[การตั้งค่าจากพี่นุ]\n- ตอบเป็นภาษา: ' + (langMap[o.lang] || 'ภาษาไทย') + '\n- ความยาวคำตอบ: ' + (lenMap[o.len] || 'ตอบปกติ') + '\n- ผู้ใช้ชื่อ: ' + (o.name || 'พี่นุ');
    }
    if (body.toolResult && t === 'teacher') sys += `\n\n[🧰 ผลเครื่องมือที่ครูเพิ่งใช้ (ข้อมูลจริง — ห้ามมโน ห้ามเติมข้อมูลที่ไม่มี)]\n${JSON.stringify(body.toolResult).slice(0, 3000)}\nตอบโดยใช้ข้อมูลนี้เป็นหลัก ถ้าข้อมูลไม่พอ/หาไม่เจอ ให้บอกตรง ๆ ว่าหาไม่เจอ`;

    const messages = [
      { role: 'system', content: sys },
      ...hist,
      { role: 'user', content: question.slice(0, 2000) }
    ];
    const out = await callAI(messages, apiKey, primary);
    return { who: t, reply: out.reply, model: out.model, fallback: out.fallback, note: out.note };
  });

  const results = await Promise.allSettled(jobs);
  const replies = [];
  let firstErr = null;
  results.forEach(rr => {
    if (rr.status === 'fulfilled') replies.push(rr.value);
    else { firstErr = firstErr || rr.reason; console.error('ใครบางคนตอบไม่สำเร็จ:', rr.reason?.message || rr.reason); }
  });

  if (!replies.length) {
    const msg = firstErr?.message || 'AI ไม่ตอบอะไรกลับมา';
    console.error('chat error:', msg);
    return res.status(502).json({ error: msg });
  }

  res.json({ replies, provider: process.env.SILICONFLOW_API_KEY ? 'siliconflow' : 'openrouter' });
};
