export function verifyChatResult(data) {
  const checks = [
    { id:'http', ok:true, detail:'API returned a response' },
    { id:'reply', ok:typeof data?.reply === 'string' && data.reply.trim().length > 0, detail:'Non-empty assistant response' },
    { id:'provider', ok:Boolean(data?.provider), detail:'Provider selected' },
    { id:'model', ok:Boolean(data?.model), detail:'Model selected' }
  ];
  return { ok:checks.every(c=>c.ok), checks, verifiedAt:new Date().toISOString() };
}

export function verifyToolResult(result) {
  const ok = result && result.status === 'success';
  return { ok, checks:[{id:'status',ok,detail:ok?'Tool reported success':'Tool did not report success'}], verifiedAt:new Date().toISOString() };
}
