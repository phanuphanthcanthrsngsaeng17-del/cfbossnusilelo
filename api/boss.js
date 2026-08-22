// CF Boss Home — Agent entrypoint.
// v1: centralizes planning context and delegates model inference to /api/chat.
// Tool execution remains permission-gated behind dedicated APIs.
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
    const instruction = [
      'CF BOSS AGENT — WORK ORDER',
      'You are the lead driver of CF Boss Home.',
      'Choose tools based on the goal. Do not claim a tool was executed unless the system actually executed it.',
      'Before any consequential action, respect scope, permission and least privilege.',
      'After a change, require verification. If a tool is unavailable, say so and continue with the safest useful step.',
      '',
      'AVAILABLE TOOL REGISTRY:',
      toolContext,
      '',
      'USER GOAL:',
      question
    ].join('\n');

    const origin = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${origin}`;
    const chat = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      tools: toolContext.split('\n').filter(Boolean).map(line => line.replace(/^- /, ''))
    });
  } catch (err) {
    console.error('CF Boss agent error:', err);
    return res.status(500).json({ error: 'Boss Agent ขัดข้อง: ' + err.message });
  }
}
