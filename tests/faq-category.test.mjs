// Regression: homepage (invitations) FAQs must stay out of the IT site and the old admin FAQ editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest } = await bundle('functions/api/[[route]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const SECRET = 'jwt-secret';

test('IT reads and old admin FAQ writes ignore invitations rows', async () => {
  const db = makeD1();
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES ('adm@jlc.test', 'a', 'Super Admin', 'Active', 1, 't')").run();
  db.exec.prepare("INSERT INTO faqs (id, question, answer, category) VALUES ('it-1', 'q', 'a', 'it')").run();
  db.exec.prepare("INSERT OR REPLACE INTO faqs (id, question, answer, category) VALUES ('inv-1', 'q', 'a', 'invitations')").run();
  const call = async (path, body) => onRequest({
    request: new Request('https://x.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + await signAdminToken('adm@jlc.test', SECRET) } }),
    env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {},
  });
  const pub = await (await call('/api/public-data')).json();
  assert.deepEqual(pub.faqs.map((f) => f.id), ['it-1']);
  const del = await (await call('/api/admin/faqs', { action: 'delete', faq: { id: 'inv-1' } })).json();
  assert.deepEqual(del.faqs.map((f) => f.id), ['it-1']);
  assert.ok(db.exec.prepare("SELECT 1 FROM faqs WHERE id = 'inv-1'").get(), 'inv-1 survives');
  await call('/api/admin/faqs', { action: 'update', faq: { id: 'inv-1', question: 'X', answer: 'X' } });
  assert.equal(db.exec.prepare("SELECT question FROM faqs WHERE id = 'inv-1'").get().question, 'q');
});
