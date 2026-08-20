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
  } = req.body;
  
  // ใช้ Groq API เป็นหลัก
  const GROQ_KEY = process.env.GROQ_API_KEY;
  
  let provider, url, body, headers;

  if (!GROQ_KEY) {
    return res.status(400).json({ 
      error: 'ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาตั้งค่าใน Environment Variables' 
    });
  }

  // ✅ ใช้ Groq API
  provider = 'groq';
  url = 'https://api.groq.com/openai/v1/chat/completions';
  body = {
    model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
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
    'Authorization': `Bearer ${GROQ_KEY}`,
    'Content-Type': 'application/json'
  };

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
    
    // ✅ ส่งกลับมา หน้าเว็บจะแสดงผล
    res.status(200).json({ 
      replies: [
        {
          reply: reply,
          who: who === 'silelo' ? 'silelo' : (who === 'teacher' ? 'teacher' : 'silelo'),
          model: data.model || (process.env.GROQ_MODEL || 'mixtral-8x7b-32768')
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
