import { redactSecrets } from './security.js';

const MAX = 100;
const memoryLog = [];

export function audit(event, data = {}) {
  const entry = { id:`audit_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, event:String(event), at:new Date().toISOString(), data:JSON.parse(redactSecrets(JSON.stringify(data))) };
  memoryLog.push(entry);
  if (memoryLog.length > MAX) memoryLog.shift();
  return entry;
}

export function recentAudit(limit = 50) { return memoryLog.slice(-Math.min(Number(limit) || 50, MAX)); }
