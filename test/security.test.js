const test = require('node:test');
const assert = require('node:assert/strict');

const { adminAuthorized } = require('../server.js');

function req(headers = {}) {
  return { headers };
}

test('admin endpoints fail closed when ADMIN_TOKEN is missing', () => {
  const previous = process.env.ADMIN_TOKEN;
  delete process.env.ADMIN_TOKEN;
  assert.equal(adminAuthorized(req({ authorization: 'Bearer anything' })), false);
  if (previous !== undefined) process.env.ADMIN_TOKEN = previous;
});

test('admin token requires a long secret and authenticates with Bearer', () => {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'a'.repeat(32);

  assert.equal(adminAuthorized(req({ authorization: `Bearer ${'a'.repeat(32)}` })), true);
  assert.equal(adminAuthorized(req({ authorization: `Bearer ${'b'.repeat(32)}` })), false);
  assert.equal(adminAuthorized(req({ authorization: 'Bearer short' })), false);

  if (previous === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = previous;
});

test('admin token also supports x-admin-token for trusted clients', () => {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'c'.repeat(32);

  assert.equal(adminAuthorized(req({ 'x-admin-token': 'c'.repeat(32) })), true);

  if (previous === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = previous;
});

test.after(() => {
  const server = require('../server.js').server;
  if (server.listening) server.close();
});
