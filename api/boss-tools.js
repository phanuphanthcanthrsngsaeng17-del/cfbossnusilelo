// CF Boss Home — central capability registry.
// Boss Core pipeline: Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify.
// Execution stays behind dedicated APIs and permission checks.
const TOOLS = {
  understand: { id:'understand', label:'Understand', description:'Parse the user goal, constraints, context and success criteria before acting.', endpoint:null, actions:['analyze','clarify'], risk:'low', requiresScope:'conversation' },
  plan: { id:'plan', label:'Plan', description:'Turn the goal into an ordered, dependency-aware work plan and choose the safest useful path.', endpoint:null, actions:['plan','route'], risk:'low', requiresScope:'conversation' },
  model_router: { id:'model_router', label:'Model Router', description:'Select an available model/provider/runtime by task capability, health and policy; skip unavailable providers automatically.', endpoint:'/api/chat', actions:['select','fallback','health'], risk:'low', requiresScope:'model' },
  tool_router: { id:'tool_router', label:'Tool Router', description:'Select the appropriate registered tools and required scopes for the planned work.', endpoint:null, actions:['select','authorize'], risk:'medium', requiresScope:'tools' },
  memory: { id:'memory', label:'Memory', description:'Use available conversation/project context and preserve reusable decisions when persistence is supported.', endpoint:null, actions:['retrieve','update'], risk:'medium', requiresScope:'memory' },
  execute: { id:'execute', label:'Execute', description:'Carry out authorized actions through the dedicated tool APIs; never claim execution without an observed result.', endpoint:null, actions:['run','change'], risk:'high', requiresScope:'execute' },
  verify: { id:'verify', label:'Verification', description:'Run post-change checks and compare expected versus observed behavior before reporting success.', endpoint:null, actions:['check','compare','regression'], risk:'medium', requiresScope:'verify' },
  sandbox: { id:'sandbox', label:'Sandbox', description:'Run code in an isolated Judge0-backed environment.', endpoint:'/api/sandbox', actions:['submit','poll'], risk:'medium', requiresScope:'sandbox' },
  web_verify: { id:'web_verify', label:'Web Verify', description:'Verify the deployed application from the public web when web access is available.', endpoint:null, actions:['inspect'], risk:'medium', requiresScope:'web' },
  github: { id:'github', label:'GitHub', description:'Inspect and change the project repository through authorized GitHub access.', endpoint:null, actions:['read','write','commit','review'], risk:'high', requiresScope:'repo' },
  deploy: { id:'deploy', label:'Deploy', description:'Deploy project changes through the configured deployment system.', endpoint:null, actions:['deploy','status'], risk:'high', requiresScope:'deploy' }
};

export function getToolRegistry() { return Object.values(TOOLS).map(t => ({...t, actions:[...t.actions]})); }
export function getTool(id) { return TOOLS[id] || null; }
export function buildToolContext() {
  return getToolRegistry().map(t => `- ${t.id}: ${t.description} Actions: ${t.actions.join(', ')}. Scope: ${t.requiresScope}. Risk: ${t.risk}.`).join('\n');
}
export default TOOLS;
