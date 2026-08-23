import { PIPELINE, buildPlan } from './agent-core.js';

export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method Not Allowed'}); }
  const goal = String(req.query?.goal || '').trim();
  return res.status(200).json({ ok:true, pipeline:PIPELINE, plan:goal ? buildPlan(goal) : [], status:goal ? 'ready' : 'idle' });
}
