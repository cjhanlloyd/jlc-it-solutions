// adminApi: the one fetch helper every admin tab uses. Node 24 strips the TypeScript types natively.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { adminApi } from '../src/components/admin/api.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const respond = (status, body, seen) => { globalThis.fetch = async (url, init) => { seen?.push({ url, init }); return new Response(JSON.stringify(body), { status }); }; };

test('GET when there is no body, with the bearer token, returning parsed JSON', async () => {
  const seen = [];
  respond(200, { db: { ok: true } }, seen);
  assert.deepEqual(await adminApi('/api/admin/data', 't'), { db: { ok: true } });
  assert.equal(seen[0].url, '/api/admin/data');
  assert.equal(seen[0].init.method, 'GET');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer t');
});

test('POST with a JSON body when a body is given', async () => {
  const seen = [];
  respond(200, { success: true }, seen);
  await adminApi('/api/x', 't', { a: 1 });
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.headers['Content-Type'], 'application/json');
  assert.equal(seen[0].init.body, '{"a":1}');
});

test("rejects with the server's error message", async () => {
  respond(403, { error: 'Access Denied' });
  await assert.rejects(adminApi('/api/x', 't', {}), { message: 'Access Denied' });
});

test('rejects with the fallback message when the server gives none', async () => {
  respond(500, {});
  await assert.rejects(adminApi('/api/x', 't', {}, 'Failed to update inquiry.'), { message: 'Failed to update inquiry.' });
});
