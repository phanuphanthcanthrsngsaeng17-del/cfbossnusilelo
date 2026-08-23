const MODELS = [
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', timeout: 20000 },
  { id: 'deepseek/deepseek-chat-v3-03:free', name: 'DeepSeek V3 03 · Free', timeout: 20000 },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', timeout: 25000 },
  { id: 'meta-llama/llama-3.1-70b-instruct:free', name: 'Llama 3.1 70B · Free', timeout: 30000 },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', timeout: 15000 },
]

export function getModels() { return MODELS }

async function call(model, messages, apiKey, timeout) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4096 }),
    signal: AbortSignal.timeout(timeout),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP ${response.status}`)
  return data.choices?.[0]?.message?.content || ''
}

export async function routeToModel(messages, preferred, apiKey) {
  if (!apiKey) throw new Error('ต้องใส่ API Key ก่อนใช้งาน')
  const candidates = preferred && preferred !== 'auto'
    ? [MODELS.find(m => m.id === preferred) || MODELS.find(m => m.id.includes(preferred)), ...MODELS]
    : MODELS
  const seen = new Set()
  const errors = []
  for (const m of candidates) {
    if (!m || seen.has(m.id)) continue
    seen.add(m.id)
    try { return { reply: await call(m.id, messages, apiKey, m.timeout), model: m.name } }
    catch (e) { errors.push(`${m.name}: ${e.message}`) }
  }
  throw new Error(`ทุกโมเดลล้มเหลว: ${errors.join(' | ')}`)
}
