const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/chat.js');

function invoke(req) {
  return new Promise(resolve => {
    const result = {};
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { result.statusCode = this.statusCode; result.body = body; resolve(result); }
    };
    Promise.resolve(handler(req, res)).catch(error => resolve({ error }));
  });
}

test('chat handler exports a callable CommonJS function', () => {
  assert.equal(typeof handler, 'function');
});

test('rejects non-POST requests', async () => {
  const out = await invoke({ method: 'GET', body: {} });
  assert.equal(out.statusCode, 405);
  assert.equal(out.body.error, 'Method Not Allowed');
});

test('validates question before calling the provider', async () => {
  const out = await invoke({ method: 'POST', body: { question: '   ' } });
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.error, 'กรุณาระบุ question');
});

test('rejects an oversized question before calling the provider', async () => {
  const out = await invoke({ method: 'POST', body: { question: 'x'.repeat(4001) } });
  assert.equal(out.statusCode, 400);
});

test('rejects invalid option objects', async () => {
  const out = await invoke({ method: 'POST', body: { question: 'hello', opt: 'bad' } });
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.error, 'opt ไม่ถูกต้อง');
});

test('returns service-unavailable when the provider key is missing', async () => {
  const previous = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  const out = await invoke({ method: 'POST', body: { question: 'hello' } });
  if (previous !== undefined) process.env.GROQ_API_KEY = previous;
  assert.equal(out.statusCode, 503);
});

test('returns a normalized reply when Groq succeeds', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { model: 'test-model', choices: [{ message: { content: 'สวัสดีครับ' } }] }; }
  });

  const out = await invoke({
    method: 'POST',
    body: { question: 'hello', room: 'living', who: 'both', history: [] }
  });

  if (previousKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = previousKey;
  global.fetch = previousFetch;

  assert.equal(out.statusCode, 200);
  assert.equal(out.body.provider, 'groq');
  assert.equal(out.body.replies[0].reply, 'สวัสดีครับ');
});
