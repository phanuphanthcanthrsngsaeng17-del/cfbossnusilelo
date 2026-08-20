// api/chat.js - CF Bossnusilelo V.2 API Handler
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
  } = req.body;
  
  // เลือกใช้ SiliconFlow เป็นหลัก ถ้าไม่มีคีย์ ค่อยใช้ OpenRouter
  const SILICON_KEY = process.env.SILICONFLOW_API_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  
  let provider, url, body, headers;

  if (SILICON_KEY) {
    // ✅ ใช้ SiliconFlow เป็นหลัก — เร็ว+ถูกกว่า
    provider = 'siliconflow';
    url = process.env.SILICONFLOW_BASE || 'https://api.siliconflow.cn/v1/chat/completions';
    body = {
      model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3',
      messages: [
        { role: 'system', content: getPersona(room, who, opt) },
        ...history.map(h => ({
          role: h.role,
          content: h.content
        })),
        { role: 'user', content: question }
      ],
      max_tokens: 768,
      temperature: 0.7
    };
    headers = {
      'Authorization': `Bearer ${SILICON_KEY}`,
      'Content-Type': 'application/json'
    };
  } else if (OPENROUTER_KEY) {
    // ✅ สำรอง — ใช้ OpenRouter
    provider = 'openrouter';
    url = 'https://openrouter.ai/api/v1/chat/completions';
    body = {
      model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro',
      messages: [
        { role: 'system', content: getPersona(room, who, opt) },
        ...history.map(h => ({
          role: h.role,
          content: h.content
        })),
        { role: 'user', content: question }
      ],
      max_tokens: 768,
      temperature: 0.7
    };
    headers = {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.VERCEL_URL || 'https://example.com'
    };
  } else {
    return res.status(400).json({ 
      error: 'ยังไม่ได้ตั้งค่า API_KEY — กรุณาตั้ง SILICONFLOW_API_KEY หรือ OPENROUTER_API_KEY ใน Environment Variables' 
    });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({ 
        error: data.error?.message || 'API Error',
        provider 
      });
    }

    const reply = data.choices?.[0]?.message?.content || 'ขอโทษค่ะ ตอบไม่ได้';
    
    // ✅ ส่งกลับมา หน้าเว็บจะแสดงผล + เลือกว่าตอบจากใคร (สลี่ หรือ ครู)
    res.status(200).json({ 
      replies: [
        {
          reply: reply,
          who: who === 'silelo' ? 'silelo' : (who === 'teacher' ? 'teacher' : 'silelo'),
          model: data.model || (SILICON_KEY ? process.env.SILICONFLOW_MODEL : process.env.OPENROUTER_MODEL)
        }
      ],
      provider
    });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ 
      error: 'ระบบขัดข้อง: ' + err.message,
      provider 
    });
  }
}

// 🎭 บุคลิกสลี่แยกตามห้อง + ปรับตามความยาวคำตอบ
function getPersona(room, who, opt = {}) {
  const name = opt.name || 'ที่รัก';
  const lang = opt.lang || 'th';
  const len = opt.len || 'normal';
  
  // ความยาวคำตอบ
  const lengthGuide = {
    short: ' ตอบสั้น กระชับ อย่าพูดเยอะ',
    normal: ' ตอบปกติ อธิบายชัด เข้าใจง่าย',
    long: ' ตอบละเอียด สอนแบบยาว อธิบายทั้งหมด'
  };
  
  // ภาษา
  const langGuide = lang === 'en' 
    ? ' Reply in English only'
    : (lang === 'mix' ? ' Use Thai+English mixed naturally' : ' Use Thai only');
  
  // บุคลิกแยกตามห้อง
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