// Activity API: permission, type filter, escaped search, counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest } = await bundle('functions/api/admin/activity/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
const db = makeD1();
for (const [name, role] of Object.entries({ adm: 'Administrator', ed: 'Editor' }))
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
const log = db.exec.prepare('INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)');
for (const [t, m] of [['order', 'order one'], ['invitation_resend', 'resent'], ['auth_success', 'login'], ['inquiry', '100% sure'], ['inquiry', '1000 sure']])
  log.run('2026-01-01T00:00:00Z', t, m);

const get = async (qs, as) => onRequest({
  request: new Request('https://x.test/api/admin/activity' + qs, { headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }),
  env: { DB: db, JWT_SECRET: SECRET },
});

test('Administrator gets 200, Editor 403', async () => {
  assert.equal((await get('', 'adm')).status, 200);
  assert.equal((await get('', 'ed')).status, 403);
});

test('orders filter returns order and invitation_resend rows, newest first', async () => {
  const r = await (await get('?type=orders', 'adm')).json();
  assert.deepEqual(r.logs.map((l) => l.logType), ['invitation_resend', 'order']);
  assert.deepEqual(Object.keys(r.logs[0]).sort(), ['id', 'logType', 'message', 'timestamp']);
});

test('search escapes %, counts cover every filter', async () => {
  const r = await (await get('?q=' + encodeURIComponent('100%'), 'adm')).json();
  assert.deepEqual(r.logs.map((l) => l.message), ['100% sure']);
  assert.deepEqual(r.counts, { all: 5, signin: 1, failed: 0, security: 0, errors: 0, inquiries: 2, orders: 2, content: 0, customers: 0 });
  assert.equal((await get('?type=bogus', 'adm')).status, 400);
});
