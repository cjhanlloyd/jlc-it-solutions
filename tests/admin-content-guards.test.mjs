// Content routes need content.manage; /api/admin/data is slim and never leaks SMTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest } = await bundle('functions/api/[[route]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const { can } = await bundle('server/permissions.ts');

const SECRET = 'jwt-secret';
const db = makeD1();
for (const [name, role] of Object.entries({ adm: 'Administrator', ed: 'Editor' }))
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
db.exec.prepare("INSERT OR REPLACE INTO smtp_settings (id, host, port, password, enabled) VALUES ('default', 'h', 587, 'SEEDED-SMTP-SECRET', 1)").run();

const call = async (path, as) => onRequest({
  request: new Request('https://x.test' + path, { method: 'POST', body: '{}', headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }),
  env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {},
});
const get = async (path, as) => onRequest({
  request: new Request('https://x.test' + path, { headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }),
  env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {},
});
const POSTS = ['services', 'faqs', 'gallery', 'process', 'roadmap', 'settings/content'];

test('Editor gets 403 on every content route; Administrator is allowed', async () => {
  assert.equal((await get('/api/admin/data', 'ed')).status, 403);
  for (const p of POSTS) assert.equal((await call('/api/admin/' + p, 'ed')).status, 403, p);
  assert.equal((await get('/api/admin/data', 'adm')).status, 200);
  for (const p of POSTS) assert.notEqual((await call('/api/admin/' + p, 'adm')).status, 403, p);
});

test('/api/admin/data is slim and leaks no SMTP password', async () => {
  const text = await (await get('/api/admin/data', 'adm')).text();
  assert.ok(!text.includes('SEEDED-SMTP-SECRET'));
  const { db: d, ...rest } = JSON.parse(text);
  assert.deepEqual(Object.keys(rest), []);
  assert.deepEqual(Object.keys(d).sort(), ['content', 'faqs', 'processSteps', 'projectGallery', 'roadmapSteps', 'services']);
});

test('permission matrix', () => {
  assert.equal(can('Administrator', 'users.manage'), false);
  assert.equal(can('Administrator', 'activity.view'), true);
  assert.equal(can('Super Admin', 'settings.email'), true);
});
