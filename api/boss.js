// CF Boss Home — Agent entrypoint.
// Boss Core pipeline: Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify.
export const config = { maxDuration: 60 };
import { buildToolContext } from './boss-tools.js';
import { buildPlan, createWorkOrder, PIPELINE } from './agent-core.js';
import { verifyChatResult } from './verification.js';
import { audit } from './audit-log.js';

const MAX_TASK = 12000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try {
    const body = req.body || {};
    const question = String(body.question || '').trim();
    if (!question) return res.status(400).json({ error: 'กรุณาระบุเป้าหมายงาน' });
    if (question.length > MAX_TASK) return res.status(413).json({ error: 'งานยาวเกินไป' });

    const workOrder = createWorkOrder(question, { room:body.room || 'living' });
    const plan = buildPlan(question);
    const toolContext = buildToolContext();
    const instruction = [
      'CF BOSS AGENT — WORK ORDER',
      'You are the lead driver of CF Boss Home. The chat is the communication surface; Boss Core is the processing system behind it.',
      'Apply this pipeline to every request: Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify.',
      'Choose technical implementation details yourself when the user gives a goal. Never claim an action happened without an observed result.',
      'Preserve explicit product decisions already made in the current conversation.',
      'AVAILABLE CAPABILITY REGISTRY:', toolContext,
      'USER GOAL:', question
    ].join('\n');

    audit('agent.start', { workOrderId:workOrder.id, goal:question, pipeline:PIPELINE });
    const origin = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${origin}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const chat = await fetch(`${base}/api/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
        body:JSON.stringify({...body, question:instruction, opt:{...(body.opt||{}), mode:body.opt?.mode||'fleet'}})
      });
      const data = await chat.json().catch(() => ({}));
      const verification = chat.ok ? verifyChatResult(data) : { ok:false, checks:[{id:'http',ok:false,detail:`HTTP ${chat.status}`}], verifiedAt:new Date().toISOString() };
      audit('agent.complete', { workOrderId:workOrder.id, httpStatus:chat.status, provider:data.provider, model:data.model, verified:verification.ok });
      return res.status(chat.status).json({
        ...data,
        agent:'cf-boss',
        workOrder:{...workOrder,status:verification.ok?'verified':'failed'},
        plan,
        corePipeline:PIPELINE,
        verification,
        tools:toolContext.split('\n').filter(Boolean).map(line => line.replace(/^- /,''))
      });
    } finally { clearTimeout(timer); }
  } catch (err) {
    console.error('CF Boss agent error:', err);
    const message = err?.name==='AbortError' ? 'Boss Agent ใช้เวลานานเกินกำหนดและถูกหยุดเพื่อไม่ให้แชทค้าง' : 'Boss Agent ขัดข้อง: '+err.message;
    return res.status(err?.name==='AbortError'?504:500).json({error:message,code:err?.name==='AbortError'?'AGENT_TIMEOUT':'AGENT_ERROR'});
  }
}
