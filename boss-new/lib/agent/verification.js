export function verifyPlan(plan) {
  const errors = []
  if (!plan || typeof plan !== 'object') errors.push('missing plan')
  if (!Array.isArray(plan?.steps)) errors.push('plan.steps must be an array')
  return { pass: errors.length === 0, errors }
}

export function verifyChanges(changes) {
  const errors = []
  if (!Array.isArray(changes)) errors.push('changes must be an array')
  for (const change of changes || []) {
    if (!change.path) errors.push('change.path missing')
    if (typeof change.content !== 'string') errors.push(`content missing: ${change.path || 'unknown'}`)
  }
  return { pass: errors.length === 0, errors }
}

export function verificationReport({ plan, changes = [], deployed = false }) {
  const p = verifyPlan(plan)
  const c = verifyChanges(changes)
  return { pass: p.pass && c.pass && (!deployed || deployed === true), plan: p, changes: c, deployment: deployed ? 'reported' : 'not-run' }
}
