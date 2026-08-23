import { getTool } from './boss-tools.js';
import { assertScope } from './security.js';

// Deliberately conservative: only adapters with an explicit implementation may execute.
const ADAPTERS = {
  model_router: async ({ input }) => ({ status:'success', output:{ delegated:true, input:String(input||'').slice(0,1000) } }),
  verify: async ({ input }) => ({ status:'success', output:{ verified:Boolean(input) } })
};

export async function executeTool({ id, input = {}, grantedScopes = [] } = {}) {
  const tool = getTool(id);
  if (!tool) return { status:'error', error:'UNKNOWN_TOOL' };
  assertScope(tool.requiresScope, grantedScopes);
  const adapter = ADAPTERS[id];
  if (!adapter) return { status:'blocked', error:'NO_EXECUTION_ADAPTER', tool:id };
  try { return { status:'success', tool:id, output:await adapter({ input }) }; }
  catch (error) { return { status:'error', tool:id, error:error.message }; }
}
