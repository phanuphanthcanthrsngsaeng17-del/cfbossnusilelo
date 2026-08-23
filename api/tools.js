import { getToolRegistry } from './boss-tools.js';
import { publicTool } from './security.js';

export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method Not Allowed'}); }
  return res.status(200).json({ ok:true, tools:getToolRegistry().map(publicTool) });
}
