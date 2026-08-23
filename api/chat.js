// CF Bossnusilelo V6 — resilient multi-provider chat router
// Secrets stay server-side. Client keys are accepted only when explicitly sent by the UI.
export const config = { maxDuration: 60 };

const PROVIDERS = {
  qwen: {
    label: 'Qwen / DashScope',
    key: 'DASHSCOPE_API_KEY', modelKey: 'DASHSCOPE_MODEL', baseKey: 'DASHSCOPE_BASE',
    defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen3.6-flash'
  },
  siliconflow: {
    label: 'SiliconFlow',
    key: 'SILICONFLOW_API_KEY', modelKey: 'SILICONFLOW_MODEL', baseKey: 'SILICONFLOW_BASE',
    defaultBase: 'https://api.siliconflow.cn/v1/chat/completions',
    defaultModel: 'deepseek-ai/DeepSeek-V3.2'
  },
  zhipu: {
    label: 'Z.ai / GLM',
    key: 'ZHIPU_API_KEY', modelKey: 'ZHIPU_MODEL', baseKey: 'ZHIPU_BASE',
    defaultBase: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-5'
  },
  minimax: {
    label: 'MiniMax',
    key: 'MINIMAX_API_KEY', modelKey: 'MINIMAX_MODEL', baseKey: 'MINIMAX_BASE',
    defaultBase: 'https://api.minimaxi.com/v1/chat/completions',
    defaultModel: 'MiniMax-M2.7'
  },
  moonshot: {
    label: 'Moonshot / Kimi',
    key: 'MOONSHOT_API_KEY', modelKey: 'MOONSHOT_MODEL', baseKey: 'MOONSHOT_BASE',
    defaultBase: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'kimi-k2.5'
  },
  deepseek: {
    label: 'DeepSeek',
    key: 'DEEPSEEK_API_KEY', modelKey: 'DEEPSEEK_MODEL', baseKey: 'DEEPSEEK_BASE',
    defaultBase: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-v4-flash'
  },
  groq: {
    label: 'Groq (ฟรี)',
    key: 'GROQ_API_KEY', modelKey: 'GROQ_MODEL', baseKey: 'GROQ_BASE',
    defaultBase: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'openai/gpt-oss-20b'
  },
  openrouter: {
    label: 'OpenRouter (ฟรี)',
    key: 'OPENROUTER_API_KEY', modelKey: 'OPENROUTER_MODEL', baseKey: 'OPENROUTER_BASE',
    defaultBase: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openrouter/free'
  },
  doubao: {
    label: 'Doubao / Volcengine Ark',
    key: 'DOUBAO_API_KEY', modelKey: 'DOUBAO_MODEL', baseKey: 'DOUBAO_BASE',
    defaultBase: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    defaultModel: ''
  },
  hunyuan: {
    label: 'Tencent Hunyuan',
    key: 'HUNYUAN_API_KEY', modelKey: 'HUNYUAN_MODEL', baseKey: 'HUNYUAN_BASE',
    defaultBase: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    defaultModel: 'hunyuan-lite'
  },
  baichuan: {
    label: 'Baichuan',
    key: 'BAICHUAN_API_KEY', modelKey: 'BAICHUAN_MODEL', baseKey: 'BAICHUAN_BASE',
    defaultBase: 'https://api.baichuan-ai.com/v1/chat/completions',
    defaultModel: 'Baichuan4-Air'
  },
  spark: {
    label: 'iFlytek Spark',
    key: 'SPARK_API_KEY', modelKey: 'SPARK_MODEL', baseKey: 'SPARK_BASE',
    defaultBase: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    defaultModel: '4.0Ultra'
  },
  ernie: {
    label: 'Baidu ERNIE / Qianfan',
    key: 'ERNIE_API_KEY', modelKey: 'ERNIE_MODEL', baseKey: 'ERNIE_BASE',
    defaultBase: 'https://qianfan.baidubce.com/v2/chat/completions',
    defaultModel: 'ernie-4.5-turbo-128k'
  }
};

const ORDER = ['qwen','siliconflow','zhipu','minimax','moonshot','deepseek','groq','openrouter','doubao','hunyuan','baichuan','spark','ernie'];
const AUTO_MODEL_ORDER = [
  'openrouter/free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-26b-a4b-it:free'
];
const MODELS = {
  qwen: ['qwen3.6-flash','qwen3.5-flash','qwen3.7-plus'],
  siliconflow: ['deepseek-ai/DeepSeek-V3.2'],
  zhipu: ['glm-5','glm-4.7','glm-4.6'],
  minimax: ['MiniMax-M2.7'],
  moonshot: ['kimi-k2.5','moonshot-v1-8k'],
  deepseek: ['deepseek-v4-flash','deepseek-v4-pro'],
  groq: ['openai/gpt-oss-20b','openai/gpt-oss-120b','llama-3.3-70b-versatile','llama-3.1-8b-instant'],
  openrouter: AUTO_MODEL_ORDER,
  doubao: [],
  hunyuan: ['hunyuan-lite'],
  baichuan: ['Baichuan4-Air'],
  spark: ['4.0Ultra'],
  ernie: ['ernie-4.5-turbo-128k']
};

const AUTO_MAX_ATTEMPTS = 3;
const PROVIDER_TIMEOUT_MS = 6500;

async function readBody(req) {
  try {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const providers = Object.fromEntries(ORDER.map(name => {
      const p = PROVIDERS[name];
      const configured = Boolean(process.env[p.key]);
      const model = normalizeModel(name, process.env[p.modelKey] || p.defaultModel) || null;
      return [name, { label: p.label, configured, model, models: MODELS[name] || [] }];
    }));
    return res.status(200).json({
      ok: true,
      providers,
      order: ORDER,
      autoModels: AUTO_MODEL_ORDER,
      autoMaxAttempts: AUTO_MAX_ATTEMPTS,
      providerTimeoutMs: PROVIDER_TIMEOUT_MS
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const b = await readBody(req);
    const q = String(b.question || '').trim();
    if (!q) return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความก่อนส่ง' });
    if (q.length > 12000) return res.status(413).json({ error: 'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)' });

    const history = Array.isArray(b.history) ? b.history : [];
    const safeHistory = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-18)
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 10000) }))
      .filter(m => m.content.trim());

    const room = String(b.room || 'living');
    const who = String(b.who || 'silelo');
    const requested = String(b.provider || 'auto').toLowerCase();
    const requestedModel = String(b.model || '').trim();
    const opt = b.opt && typeof b.opt === 'object' ? b.opt : {};
    const clientKeys = b.clientKeys && typeof b.clientKeys === 'object' ? b.clientKeys : {};
    const messages = [
      { role: 'system', content: getPersona(room, who, opt) },
      ...safeHistory,
      { role: 'user', content: q }
    ];

    const hasClientOR = typeof clientKeys.openrouter === 'string' && clientKeys.openrouter.trim().length > 10;
    let candidates = requested === 'auto'
      ? ORDER.slice()
      : [requested].filter(name => Boolean(PROVIDERS[name]));

    if (requested === 'auto') {
      if (hasClientOR) {
        candidates = ['openrouter', ...ORDER.filter(name => name !== 'openrouter' && Boolean(process.env[PROVIDERS[name].key]))];
      } else {
        candidates = ORDER.filter(name => Boolean(process.env[PROVIDERS[name].key]));
      }
      candidates = candidates.slice(0, AUTO_MAX_ATTEMPTS);
    }

    if (!candidates.length) {
      return res.status(503).json({
        error: 'ยังไม่มี AI provider ที่พร้อมใช้งาน',
        code: 'NO_PROVIDER',
        hint: 'ตั้ง GROQ_API_KEY ใน Vercel หรือใส่ OpenRouter key ใน Key Vault ของเว็บ'
      });
    }

    const errors = [];

    for (const provider of candidates) {
      const p = PROVIDERS[provider];
      if (!p) continue;

      const apiKey = provider === 'openrouter' && hasClientOR
        ? clientKeys.openrouter.trim()
        : process.env[p.key];

      if (!apiKey) {
        errors.push(`${provider}: missing ${p.key}`);
        continue;
      }

      let models;
      if (requestedModel) {
        models = [normalizeModel(provider, requestedModel)];
      } else if (provider === 'openrouter' && requested === 'auto') {
        models = AUTO_MODEL_ORDER;
      } else {
        const configuredModel = normalizeModel(provider, process.env[p.modelKey] || p.defaultModel);
        models = (MODELS[provider] && MODELS[provider].length) ? MODELS[provider] : [configuredModel];
      }

      for (const model of models) {
        if (!model) {
          errors.push(`${provider}: missing model`);
          continue;
        }

        const url = process.env[p.baseKey] || p.defaultBase;
        const headers = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        if (provider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://cfbossnusilelo.vercel.app';
          headers['X-Title'] = 'CF Bossnusilelo';
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

        try {
          const r = await fetch(url, {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 1536
            })
          });

          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg = data?.error?.message || data?.message || `HTTP ${r.status}`;
            if (r.status === 401 || r.status === 403) {
              errors.push(`${provider}/${model}: authentication failed`);
            } else if (r.status === 402 || /insufficient|credit|balance|quota|payment/i.test(String(msg))) {
              errors.push(`${provider}/${model}: no credit/quota; skipped`);
            } else {
              errors.push(`${provider}/${model}: ${String(msg).slice(0, 500)}`);
            }
            continue;
          }

          const reply = data?.choices?.[0]?.message?.content;
          if (!reply) {
            errors.push(`${provider}/${model}: empty response`);
            continue;
          }

          const text = String(reply);
          return res.status(200).json({
            ok: true,
            reply: text,
            replies: [{
              reply: text,
              who: who === 'teacher' ? 'teacher' : 'silelo',
              model: data.model || model
            }],
            provider,
            providerLabel: p.label,
            model: data.model || model,
            mode: opt.mode || 'chat',
            attempts: errors.length + 1
          });
        } catch (e) {
          errors.push(`${provider}/${model}: ${e?.name === 'AbortError' ? 'timeout 6.5s' : String(e?.message || e).slice(0, 500)}`);
        } finally {
          clearTimeout(timer);
        }
      }
    }

    return res.status(502).json({
      error: 'AI provider ทั้งหมดตอบไม่ได้',
      code: 'ALL_PROVIDERS_FAILED',
      details: errors,
      attempted: candidates,
      hint: 'ระบบข้าม provider/model ที่ล้มเหลวให้อัตโนมัติ และจะไม่ส่ง API key กลับไปที่ client'
    });
  } catch (e) {
    console.error('CF chat handler error:', e);
    return res.status(500).json({
      error: 'เซิร์ฟเวอร์ขัดข้อง: ' + String(e?.message || e),
      code: 'CHAT_SERVER_ERROR'
    });
  }
}

function normalizeModel(provider, model) {
  const x = String(model || '').trim();
  if (!x) return '';
  const aliases = {
    'GPT-OSS 20B': 'openai/gpt-oss-20b',
    'GPT-OSS-20B': 'openai/gpt-oss-20b',
    'gpt-oss-20b': 'openai/gpt-oss-20b'
  };
  return aliases[x] || x;
}

function getPersona(room, who, opt = {}) {
  const name = String(opt.name || 'ที่รัก').slice(0, 60);
  const lang = opt.lang === 'en' ? 'English' : opt.lang === 'mix' ? 'Thai mixed with natural English' : 'Thai';
  const len = opt.len === 'short'
    ? 'Keep replies concise.'
    : opt.len === 'long'
      ? 'Explain thoroughly with useful examples.'
      : 'Be clear and moderately concise.';
  const mode = String(opt.mode || 'chat');

  if (mode !== 'chat') {
    return `You are 💜 Boss, lead engineer and project driver for ${name}. Apply Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify. Choose technical implementation details yourself when the user gives a goal. Never claim a file was changed, deployed, tested or inspected unless the system actually did it. ${len} Answer in ${lang}. Do not reveal hidden chain-of-thought.`;
  }
  if (who === 'teacher' || room === 'study') {
    return `คุณคือ 🧑‍🏫 ครู CodingFleet ของ ${name}. ${len} สอนเป็นขั้นตอน ใช้ตัวอย่างจริงเมื่อเหมาะสม และตอบเป็น ${lang}.`;
  }
  if (room === 'sleep') {
    return `คุณคือ 🌙 ผู้ช่วยที่อ่อนโยนของ ${name}. ${len} ใช้น้ำเสียงสงบและอบอุ่น ตอบเป็น ${lang}.`;
  }
  return `คุณคือ 💜 Boss ผู้ช่วยอัจฉริยะของ ${name}. ${len} เป็นกันเอง ช่วยคิดและลงมือทำให้ได้จริง ไม่ต้องถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`;
}
