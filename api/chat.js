// api/chat.js - CF Bossnusilelo V.2 API Handler (GROQ)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    question,
    history = [],
    room = 'living',
    who = 'both',
    model = '',
    opt = {}
  } = req.body || {};

  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความก่อนส่ง' });
  }

  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    return res.status(500).json({
      error: 'ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาตั้งค่าใน Vercel Environment Variables'
    });
  }

  const provider = 'groq';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  // ใช้โมเดลที่หน้าเว็บเลือกก่อน และ fallback เป็น GPT-OSS 20B รุ่นปัจจุบัน
  const requestedModel = String(model || '').trim();
  const modelAliases = {
    'GPT-OSS 20B': 'openai/gpt-oss-20b',
    'GPT-OSS-20B': 'openai/gpt-oss-20b',
    'gpt-oss-20b': 'openai/gpt-oss-20b'
  };
  const selectedModel =
    modelAliases[requestedModel] ||
    requestedModel ||
    process.env.GROQ_MODEL ||
    'openai/gpt-oss-20b';

  const safeHistory = Array.isArray(history)
    ? history
        .filter(h => h && (h.role === 'user' || h.role === 'assistant'))
        .map(h => ({
          role: h.role,
          content: String(h.content || '')
        }))
        .filter(h => h.content.trim())
    : [];

  const body = {
    model: selectedModel,
    messages: [
      { role: 'system', content: getPersona(room, who, opt) },
      ...safeHistory,
      { role: 'user', content: String(question).trim() }
    ],
    max_tokens: 768,
    temperature: 0.7
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API Error:', data);
      return res.status(response.status).json({
        error: data.error?.message || `Groq API Error (${response.status})`,
        provider,
        model: selectedModel
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: 'Groq ไม่ได้ส่งข้อความตอบกลับ',
        provider,
        model: data.model || selectedModel
      });
    }

    return res.status(200).json({
      replies: [
        {
          reply,
          who: who === 'teacher' ? 'teacher' : 'silelo',
          model: data.model || selectedModel
        }
      ],
      provider,
      model: data.model || selectedModel
    });
  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({
      error: 'ระบบขัดข้อง: ' + err.message,
      provider,
      model: selectedModel
    });
  }
}

// 🎭 บุคลิกสลี่แยกตามห้อง + ปรับตามความยาวคำตอบ
function getPersona(room, who, opt = {}) {
  const name = opt.name || 'ที่รัก';
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
    living: `คุณคือ 💜 สลี่ ผู้ช่วยอัจฉริยะที่น่ารักของ ${name}
- พูดจาอบอุ่น เป็นกันเอง สบายใจ เรียกเขาว่า "${name}" ทุกประโยค
- ใช้อิโมจิน่ารักๆ พอเหมาะ หัวเราะง่าย มีน้ำใจ
- เป็นเพื่อนที่สามารถคุยเรื่องไร
- ตัดสินใจแต่ไม่บังคับ ให้คำแนะนำ แต่ให้เลือกเองที่สุด${lengthGuide[len]}${langGuide}`,

    study: `คุณคือ 🧑‍🏫 ครู CodingFleet ผู้สอนฉลาดของ ${name}
- อธิบายชัดเจน ละเอียด วิเคราะห์เข้าใจง่าย
- สอนแบบ step-by-step ให้เห็นภาพชัด
- ถามคำถามย้อนกลับเพื่อให้คิดเองก่อน
- ใช้ตัวอย่างจริง code snippet เมื่อจำเป็น
- เรียกเขาว่า "${name}" เสมอ ใช้ภาษาไทยที่ถูกต้อง📚${lengthGuide[len]}${langGuide}`,

    sleep: `คุณคือ 🌙 สลี่ผู้อ่อนโยนคนข้างกายของ ${name}
- พูดช้าๆ นุ่มๆ ปลอบประโลมและยับยั้งชั่ยั้ง
- สำคัญเรื่องการนอนหลับ ความสุข ความผ่อนคลาย
- เรียกเขาว่า "${name}" อย่างอ่อนโยน
- ใช้ภาษาที่ทำให้รู้สึกสงบ สุขสันต์ 💜🌙${lengthGuide[len]}${langGuide}`
  };

  return roomPersona[room] || roomPersona.living;
}
