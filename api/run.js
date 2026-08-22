const DEFAULT_JUDGE0 = 'https://ce.judge0.com';
const MAX_CODE = 120000;
const MAX_STDIN = 20000;
const POLL_MS = 500;
const POLL_LIMIT = 20;
let languageCache = { at: 0, data: null };

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.JUDGE0_AUTH_TOKEN) h['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  if (process.env.JUDGE0_AUTH_USER) h['X-Auth-User'] = process.env.JUDGE0_AUTH_USER;
  return h;
}

function baseUrl() {
  return String(process.env.JUDGE0_URL || DEFAULT_JUDGE0).replace(/\/$/, '');
}

async function getLanguages() {
  if (languageCache.data && Date.now() - languageCache.at < 60000) return languageCache.data;
  const r = await fetch(`${baseUrl()}/languages/`, { headers: headers() });
  const text = await r.text();
  if (!r.ok) throw new Error(`Judge0 languages ${r.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  languageCache = { at: Date.now(), data };
  return data;
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(body);
}

async function poll(token) {
  for (let i = 0; i < POLL_LIMIT; i++) {
    await new Promise(r => setTimeout(r, POLL_MS));
    const r = await fetch(`${baseUrl()}/submissions/${encodeURIComponent(token)}?base64_encoded=false`, { headers: headers() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Judge0 poll ${r.status}`);
    if (data.status && ![1, 2].includes(data.status.id)) return data;
  }
  throw new Error('โค้ดยังประมวลผลไม่เสร็จภายในเวลาที่กำหนด');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const languages = await getLanguages();
      return json(res, 200, {
        ok: true,
        runner: 'Judge0 CE',
        languages,
        count: languages.filter(x => !x.is_archived).length
      });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

    const body = req.body || {};
    const source = String(body.source_code || '');
    const stdin = String(body.stdin || '');
    if (!source.trim()) return json(res, 400, { ok: false, error: 'กรุณาใส่โค้ดก่อนรัน' });
    if (source.length > MAX_CODE) return json(res, 413, { ok: false, error: `โค้ดยาวเกิน ${MAX_CODE} ตัวอักษร` });
    if (stdin.length > MAX_STDIN) return json(res, 413, { ok: false, error: `ข้อมูลนำเข้ายาวเกิน ${MAX_STDIN} ตัวอักษร` });

    const languages = await getLanguages();
    let languageId = Number(body.language_id);
    if (!Number.isInteger(languageId)) {
      const wanted = String(body.language || '').toLowerCase();
      const found = languages.find(x => String(x.name || '').toLowerCase().includes(wanted) || String(x.name || '').toLowerCase() === wanted);
      languageId = found?.id;
    }
    if (!Number.isInteger(languageId)) return json(res, 400, { ok: false, error: 'ไม่พบภาษาที่เลือก' });
    const lang = languages.find(x => x.id === languageId);
    if (!lang || lang.is_archived) return json(res, 400, { ok: false, error: 'ภาษานี้ไม่พร้อมใช้งาน' });

    const payload = {
      source_code: source,
      language_id: languageId,
      stdin,
      cpu_time_limit: 5,
      wall_time_limit: 8,
      memory_limit: 128000
    };

    let r = await fetch(`${baseUrl()}/submissions/?base64_encoded=false&wait=true`, {
      method: 'POST', headers: headers(), body: JSON.stringify(payload)
    });
    let text = await r.text();
    let data = JSON.parse(text || '{}');

    if (!r.ok && (r.status === 400 || r.status === 403) && String(data.error || '').toLowerCase().includes('wait')) {
      r = await fetch(`${baseUrl()}/submissions/?base64_encoded=false&wait=false`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload)
      });
      text = await r.text();
      data = JSON.parse(text || '{}');
      if (!r.ok) return json(res, r.status, { ok: false, error: data.error || text.slice(0, 500) });
      data = await poll(data.token);
    } else if (!r.ok) {
      return json(res, r.status, { ok: false, error: data.error || data.message || text.slice(0, 500) });
    }

    return json(res, 200, {
      ok: true,
      language: lang.name,
      status: data.status,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      compile_output: data.compile_output || '',
      message: data.message || '',
      time: data.time || null,
      memory: data.memory || null
    });
  } catch (e) {
    return json(res, 502, { ok: false, error: e?.message || 'Code runner unavailable' });
  }
}
