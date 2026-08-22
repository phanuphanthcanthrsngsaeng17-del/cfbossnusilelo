// api/chat.js - CF Bossnusilelo V.2 API Handler (GROQ)
// CommonJS so it works both as a Vercel function and when loaded by server.js.

const ALLOWED_ROOMS = new Set(['living', 'study', 'sleep']);
const ALLOWED_WHO = new Set(['both', 'silelo', 'teacher']);
const ALLOWED_LANG = new Set(['th', 'en', 'mix']);
const ALLOWED_LEN = new Set(['short', 'normal', 'long']);
const MAX_HISTORY = 40;
const MAX_QUESTION_CHARS = 4000;
const MAX_HISTORY_CONTENT_CHARS = 4000;

function error(res, status, message) {
  return res.status(status).json({ error: message });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return error(res, 405, 'Method Not Allowed');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const {
    question,
    history = [],
    room = 'living',
    who = 'both',
    opt = {}
  } = body;

  if (typeof question !== 'string' || question.trim().length === 0) {
    return error(res, 400, 'กรุณาระบุ question');
  }
  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > MAX_QUESTION_CHARS) {
    return error(res, 400, `question ยาวเกิน ${MAX_QUESTION_CHARS} ตัวอักษร`);
  }
  if (!ALLOWED_ROOMS.has(room)) {
    return error(res, 400, 'room ไม่ถูกต้อง');
  }
  if (!ALLOWED_WHO.has(who)) {
    return error(res, 400, 'who ไม่ถูกต้อง');
  }
  if (opt !== null && (typeof opt !== 'object' || Array.isArray(opt))) {
    return error(res, 400, 'opt ไม่ถูกต้อง');
  }

  const safeHistory = Array.isArray(history)
    ? history.slice(-MAX_HISTORY).filter(h =>
      h &&
      (h.role === 'user' || h.role === 'assistant') &&
      typeof h.content === 'string' &&
      h.content.trim().length > 0 &&
      h.content.length <= MAX_HISTORY_CONTENT_CHARS
    )
    : [];

  const safeOpt = opt || {};
  const lang = typeof safeOpt.lang === 'string' && ALLOWED_LANG.has(safeOpt.lang) ? safeOpt.lang : 'th';
  const len = typeof safeOpt.len === 'string' && ALLOWED_LEN.has(safeOpt.len) ? safeOpt.len : 'normal';

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return error(res, 503, 'ยังไม่ได้ตั้งค่า GROQ_API_KEY');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const provider = 'groq';
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = {
    model,
    messages: [
      { role: 'system', content: getPersona(room, who, { ...safeOpt, lang, len }) },
      ...safeHistory.map(h => ({ role: h.role, content: h.content.trim() })),
      { role: 'user', content: trimmedQuestion }
    ],
    max_tokens: 768,
    temperature: 0.7
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await response.json(); } catch { /* non-JSON provider response */ }

    if (!response.ok) {
      console.error('Groq API request failed:', response.status);
      return res.status(502).json({
        error: 'ผู้ให้บริการ AI ตอบกลับผิดพลาด',
        provider
      });
    }

    const reply = data.choices?.[0]?.message?.content || 'ขอโทษค่ะ ตอบไม่ได้';
    return res.status(200).json({
      replies: [{
        reply,
        who: who === 'teacher' ? 'teacher' : 'silelo',
        model: data.model || model
      }],
      provider
    });
  } catch (err) {
    console.error('AI provider request failed:', err.message);
    return res.status(502).json({
      error: 'เชื่อมต่อผู้ให้บริการ AI ไม่สำเร็จ',
      provider
    });
  }
}

function getPersona(room, who, opt = {}) {
  const name = typeof opt.name === 'string' && opt.name.trim() ? opt.name.trim().slice(0, 80) : 'ที่รัก';
  const lang = opt.lang || 'th';
  const len = opt.len || 'normal';

  const lengthGuide = {
    short: ' ตอบสั้น กระชับ อย่าพูดเยอะ',
    normal: ' ตอบปกติ อธิบายชัด เข้าใจง่าย',
    long: ' ตอบละเอียด สอนแบบยาว อธิบายทั้งหมด'
  };
  const langGuide = lang === 'en'
    ? ' Reply in English only'
    : (lang === 'mix' ? ' Use Thai+English mixed naturally' : ' Use Thai only');
  const roomPersona = {
    living: `คุณคือ 💜 สลี่ ผู้ช่วยอัจฉริยะที่น่ารักของ ${name}\n- พูดจาอบอุ่น เป็นกันเอง สบายใจ เรียกเขาว่า "${name}" ทุกประโยค\n- ใช้อิโมจิน่ารักๆ พอเหมาะ หัวเราะง่าย มีน้ำใจ\n- เป็นเพื่อนที่สามารถคุยเรื่องไร\n- ตัดสินใจแต่ไม่บังคับ ให้คำแนะนำ แต่ให้เลือกเองที่สุด${lengthGuide[len] || lengthGuide.normal}${langGuide}`,
    study: `คุณคือ 🧑‍🏫 ครู CodingFleet ผู้สอนฉลาดของ ${name}\n- อธิบายชัดเจน ละเอียด วิเคราะห์เข้าใจง่าย\n- สอนแบบ step-by-step ให้เห็นภาพชัด\n- ถามคำถามย้อนกลับเพื่อให้คิดเองก่อน\n- ใช้ตัวอย่างจริง code snippet เมื่อจำเป็น\n- เรียกเขาว่า "${name}" เสมอ ใช้ภาษาไทยที่ถูกต้อง📚${lengthGuide[len] || lengthGuide.normal}${langGuide}`,
    sleep: `คุณคือ 🌙 สลี่ผู้อ่อนโยนคนข้างกายของ ${name}\n- พูดช้าๆ นุ่มๆ ปลอบประโลมและยับยั้งชั่ยั้ง\n- สำคัญเรื่องการนอนหลับ ความสุข ความผ่อนคลาย\n- เรียกเขาว่า "${name}" อย่างอ่อนโยน\n- ใช้ภาษาที่ทำให้รู้สึกสงบ สุขสันต์ 💜🌙${lengthGuide[len] || lengthGuide.normal}${langGuide}`
  };

  return roomPersona[room] || roomPersona.living;
}

module.exports = handler;
module.exports.getPersona = getPersona;
