// CF Boss Home — central tool registry.
// This file describes capabilities available to the Boss Agent.
// Execution stays behind dedicated APIs and permission checks.
const TOOLS = {
  sandbox: {
    id: 'sandbox', label: 'Sandbox', description: 'Run code in an isolated Judge0-backed environment.',
    endpoint: '/api/sandbox', actions: ['submit', 'poll'], risk: 'medium', requiresScope: 'sandbox'
  },
  web_verify: {
    id: 'web_verify', label: 'Web Verify', description: 'Verify the deployed application from the public web.',
    endpoint: null, actions: ['inspect'], risk: 'medium', requiresScope: 'web'
  },
  github: {
    id: 'github', label: 'GitHub', description: 'Inspect and change the project repository through authorized GitHub access.',
    endpoint: null, actions: ['read', 'write', 'commit', 'review'], risk: 'high', requiresScope: 'repo'
  },
  deploy: {
    id: 'deploy', label: 'Deploy', description: 'Deploy project changes through the configured deployment system.',
    endpoint: null, actions: ['deploy', 'status'], risk: 'high', requiresScope: 'deploy'
  },
  verify: {
    id: 'verify', label: 'Verification', description: 'Run post-change checks and compare expected versus observed behavior.',
    endpoint: null, actions: ['check'], risk: 'medium', requiresScope: 'verify'
  }
};

export function getToolRegistry() {
  return Object.values(TOOLS).map(t => ({...t, actions:[...t.actions]}));
}

export function getTool(id) {
  return TOOLS[id] || null;
}

export function buildToolContext() {
  return getToolRegistry().map(t =>
    `- ${t.id}: ${t.description} Actions: ${t.actions.join(', ')}. Scope: ${t.requiresScope}. Risk: ${t.risk}.`
  ).join('\n');
}

export default TOOLS;
