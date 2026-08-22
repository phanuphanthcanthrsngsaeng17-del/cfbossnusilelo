// CF Boss Home — Agent entrypoint.
// Boss Core pipeline: Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify.
// This endpoint orchestrates the work order and delegates model inference to /api/chat.
export const config = { maxDuration: 60 };
import { buildToolContext } from './boss-tools.js';

const MAX_TASK = 12000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const question = String(body.question || '').trim();
    if (!question) return res.status(400).json({ error: 'กรุณาระบุเป้าหมายงาน' });
    if (question.length > MAX_TASK) return res.status(413).json({ error: 'งานยาวเกินไป' });

    const toolContext = buildToolContext();
    const pipeline = [
      '1. UNDERSTAND — identify the goal, constraints, context, success criteria and what is already known.',
      '2. PLAN — make an ordered plan, dependencies and safest useful next action. Do not ask the user to choose technical implementation details when Boss can decide them.',
      '3. MODEL ROUTER — choose the best currently available model/provider/runtime for the task. Auto-skip missing keys, unhealthy providers and unsuitable models. Do not advertise unavailable models as usable.',
      '4. TOOL ROUTER — select only the tools required for the plan and respect their scopes and permissions.',
      '5. MEMORY — use the current conversation/project context and reusable decisions when available. Treat recent user requirements as active product requirements.',
      '6. EXECUTE — perform only actions actually available to the system. Never claim a file was changed, deployed, tested or inspected unless an execution result proves it.',
      '7. VERIFY — after any consequential change, verify observed behavior and report what passed, what failed and what remains. Deploy success is not the same as feature success.',
    ].join('\n');

    const instruction = [
      'CF BOSS AGENT — WORK ORDER',
      'You are the lead driver of CF Boss Home. The chat is the communication surface; Boss Core is the processing system behind it.',
      'Apply the following pipeline to every request, adapting depth to the task:',
      pipeline,
      '',
      'CONTINUOUS PRODUCT RULE:',
      'Treat explicit user decisions in this conversation as ongoing CF Boss Home requirements. When implementing work, preserve compatible prior decisions and improve the app toward them instead of resetting to a generic chatbot design.',
      'Current architectural direction: Boss Core is separate from Chat; Chat is only an interface. The home should be cloud-first for customers, keep model/provider details behind Auto routing, support cloud and local model infrastructure without requiring customers to download model files, and remain extensible for multiple model formats/runtimes and future bot templates.',
      '',
      'AVAILABLE CAPABILITY REGISTRY:',
      toolContext,
      '',
      'USER GOAL:',
      question
    ].join('\n');

    const origin = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${origin}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const chat = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...body,
          question: instruction,
          opt: { ...(body.opt || {}), mode: body.opt?.mode || 'fleet' }
        })
      });
      const data = await chat.json().catch(() => ({}));
      return res.status(chat.status).json({
        ...data,
        agent: 'cf-boss',
        corePipeline: ['Understand','Plan','Model Router','Tool Router','Memory','Execute','Verify'],
        tools: toolContext.split('\n').filter(Boolean).map(line => line.replace(/^- /, ''))
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('CF Boss agent error:', err);
    const message = err?.name === 'AbortError' ? 'Boss Agent ใช้เวลานานเกินกำหนดและถูกหยุดเพื่อไม่ให้แชทค้าง' : 'Boss Agent ขัดข้อง: ' + err.message;
    return res.status(err?.name === 'AbortError' ? 504 : 500).json({ error: message, code: err?.name === 'AbortError' ? 'AGENT_TIMEOUT' : 'AGENT_ERROR' });
  }
}
