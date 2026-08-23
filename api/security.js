// CF Boss security primitives. Never expose secret values to clients or logs.
const SECRET_KEYS = ['OPENROUTER_API_KEY','EMERGENT_LLM_KEY','JWT_SECRET','DASHSCOPE_API_KEY','DEEPSEEK_API_KEY','GROQ_API_KEY','SILICONFLOW_API_KEY','ZHIPU_API_KEY','MINIMAX_API_KEY','MOONSHOT_API_KEY'];
const SCOPES = new Set(['conversation','model','tools','memory','execute','verify','sandbox','web','repo','deploy']);

export function redactSecrets(value) {
  let s = typeof value === 'string' ? value : JSON.stringify(value);
  for (const key of SECRET_KEYS) {
    const re = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,;]+)`, 'gi');
    s = s.replace(re, '$1[REDACTED]');
  }
  return s;
}

export function canUseScope(scope, granted = []) {
  return SCOPES.has(scope) && Array.isArray(granted) && granted.includes(scope);
}

export function assertScope(scope, granted = []) {
  if (!canUseScope(scope, granted)) {
    const e = new Error(`Permission denied: ${scope}`);
    e.code = 'PERMISSION_DENIED';
    throw e;
  }
}

export function publicTool(tool) {
  if (!tool) return null;
  return { id:tool.id, label:tool.label, description:tool.description, actions:tool.actions, risk:tool.risk, requiresScope:tool.requiresScope, endpoint:tool.endpoint };
}
