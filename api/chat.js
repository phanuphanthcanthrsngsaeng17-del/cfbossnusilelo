// CF Bossnusilelo V2 — unified chat API
// Provider order: SiliconFlow -> OpenRouter -> Groq

const PROVIDERS = {
  siliconflow: { key: 'SILICONFLOW_API_KEY', modelKey: 'SILICONFLOW_MODEL', baseKey: 'SILICONFLOW_BASE', defaultBase: 'https://api.siliconflow.cn/v1/chat/completions', defaultModel: 'deepseek-ai/DeepSeek-V3' },
  openrouter: { key: 'OPENROUTER_API_KEY', modelKey: 'OPENROUTER_MODEL', baseKey: 'OPENROUTER_BASE', defaultBase: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: '' },
  groq: { key: 'GROQ_API_KEY', modelKey: 'GROQ_MODEL', baseKey: 'GROQ_BASE', defaultBase: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'openai/gpt-oss-20b' }
};
const ORDER = ['siliconflow', 'openrouter', 'groq'];

export default async function handler(req, res) {
  // Lightweight health/config check. Never expose secret values.
  if (req.method === 'GET') {
    const providers = Object.fromEntries(ORDER.map(name => {
      const cfg = PROVIDERS[name];
      const configured = Boolean(process.env[cfg.key]);
      const model = normalizeModel(name, process.env[cfg.modelKey] || cfg.defaultModel);
      return [name, { configured, model: model || null }];
    }));
    return res.status(200).json({ ok: true, service: 'CF Bossnusilelo Chat API', providers, order: ORDER });
  }

  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try {
    const body = req.body || {};
    const question = String(body.question || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const room = String(body.room || 'living');
    const who = String(body.who || 'silelo');
    const requested = String(body.provider || 'auto').toLowerCase();
    const requestedModel = String(body.model || '').trim();
    const opt = body.opt && typeof body.opt === 'object' ? body.opt : {};

    if (!question) return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความก่อนส่ง' });
    if (question.length > 12000) return res.status(413).json({ error: 'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)' });

    const safeHistory = history.filter(m => m && (m.role === 'user' || m.role === 'assistant')).slice(-20)
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 12000) })).filter(m => m.content.trim());
    const messages = [{ role: 'system', content: getPersona(room, who, opt) }, ...safeHistory, { role: 'user', content: question }];
    const candidates = requested === 'auto' ? ORDER : [requested].filter(p => PROVIDERS[p]);
    if (!candidates.length) return res.status(400).json({ error: 'ไม่รู้จัก provider ที่เลือก' });

    const errors = [];
    for (const provider of candidates) {
      const cfg = PROVIDERS[provider];
      const apiKey = process.env[cfg.key];
      if (!apiKey) { errors.push(`${provider}: ยังไม่ได้ตั้ง ${cfg.key}`); continue; }
      const model = normalizeModel(provider, requestedModel || process.env[cfg.modelKey] || cfg.defaultModel);
      if (!model) { errors.push(`${provider}: ยังไม่ได้ตั้ง model`); continue; }
      const url = process.env[cfg.baseKey] || cfg.defaultBase;
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      if (provider === 'openrouter') { headers['HTTP-Referer'] = 'https://cfbossnusilelo.vercel.app'; headers['X-Title'] = 'CF Bossnusilelo'; }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const r = await fetch(url, { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { errors.push(`${provider}/${model}: ${data?.error?.message || data?.message || `HTTP ${r.status}`}`); continue; }
        const reply = data?.choices?.[0]?.message?.content;
        if (!reply) { errors.push(`${provider}/${model}: ไม่มีข้อความตอบกลับ`); continue; }
        return res.status(200).json({ ok: true, reply: String(reply), replies: [{ reply: String(reply), who: who === 'teacher' ? 'teacher' : 'silelo', model: data.model || model }], provider, model: data.model || model });
      } catch (err) {
        errors.push(`${provider}/${model}: ${err.name === 'AbortError' ? 'หมดเวลารอ 45 วินาที' : err.message}`);
      } finally { clearTimeout(timer); }
    }
    return res.status(502).json({ error: 'AI ยังตอบไม่ได้', details: errors, hint: 'ตรวจ Environment Variables ของ SiliconFlow / OpenRouter / Groq ใน Vercel' });
  } catch (err) {
    console.error('CF chat handler error:', err);
    return res.status(500).json({ error: 'เซิร์ฟเวอร์ขัดข้อง: ' + err.message });
  }
}

function normalizeModel(provider, model) {
  const m = String(model || '').trim(); if (!m) return '';
  const aliases = { 'GPT-OSS 20B': 'openai/gpt-oss-20b', 'GPT-OSS-20B': 'openai/gpt-oss-20b', 'gpt-oss-20b': 'openai/gpt-oss-20b' };
  if (aliases[m]) return aliases[m];
  return m;
}

function getPersona(room, who, opt = {}) {
  const name = String(opt.name || 'ที่รัก').slice(0, 60);
  const lang = opt.lang === 'en' ? 'English' : opt.lang === 'mix' ? 'Thai mixed with natural English' : 'Thai';
  const len = opt.len === 'short' ? 'Keep replies concise.' : opt.len === 'long' ? 'Explain thoroughly with useful examples.' : 'Be clear and moderately concise.';
  if (who === 'teacher' || room === 'study') return `คุณคือ 🧑‍🏫 ครู CodingFleet ของ ${name}. ${len} สอนเป็นขั้นตอน ใช้ตัวอย่างจริงเมื่อเหมาะสม และตอบเป็น ${lang}.`;
  if (room === 'sleep') return `คุณคือ 🌙 สลี่ ผู้ช่วยที่อ่อนโยนของ ${name}. ${len} ใช้น้ำเสียงสงบและอบอุ่น ตอบเป็น ${lang}.`;
  return `คุณคือ 💜 สลี่ ผู้ช่วยอัจฉริยะของ ${name}. ${len} เป็นกันเอง ช่วยคิดและลงมือทำให้ได้จริง ไม่ต้องถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`;
}
