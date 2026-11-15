// Admin customers API on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: customers } = await bundle('functions/api/admin/customers/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
let db, n;
beforeEach(() => {
  db = makeD1();
  n = 0;
  for (const [name, role] of Object.entries({ adm: 'Administrator', ed: 'Editor' })) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
});

const addCustomer = (email, name) => Number(db.exec.prepare('INSERT INTO customers (email, name) VALUES (?, ?)').run(email, name).lastInsertRowid);
const addOrder = (cid, status, amount, createdAt = '2026-01-01 10:00:00') => Number(db.exec.prepare(
  "INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, customer_id, provider, created_at) VALUES (1, 'x', ?, ?, ?, ?, 'manual_gcash', ?)",
).run(amount, status, `JLC-${++n}`, cid, createdAt).lastInsertRowid);
const call = async (path, { as, body } = {}) => {
  const headers = as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {};
  return customers({ request: new Request('https://shop.test/api/admin/customers' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers }),
    env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {} });
};

test('auth: no token 401, Editor 403', async () => {
  const id = addCustomer('a@x.com', 'A');
  assert.equal((await call('')).status, 401);
  assert.equal((await call('', { as: 'ed' })).status, 403);
  assert.equal((await call(`/${id}`, { as: 'ed', body: { name: 'Z' } })).status, 403);
});

test('list: paid total excludes refunded and cancelled; search by email or name; wildcards escaped', async () => {
  const a = addCustomer('ann@x.com', 'Ann');
  addCustomer('bob@x.com', 'Bob_Smith');
  addOrder(a, 'completed', 1000);
  addOrder(a, 'refunded', 500);
  addOrder(a, 'cancelled', 700);
  addOrder(a, 'delivered', 200);
  const all = await (await call('', { as: 'adm' })).json();
  const ann = all.customers.find((c) => c.id === a);
  assert.equal(ann.orders, 4);
  assert.equal(ann.paidCentavos, 1200);
  assert.equal(ann.lastActivity, '2026-01-01T10:00:00Z');
  assert.deepEqual((await (await call('?q=ANN@', { as: 'adm' })).json()).customers.map((c) => c.email), ['ann@x.com']);
  assert.deepEqual((await (await call('?q=bob', { as: 'adm' })).json()).customers.map((c) => c.email), ['bob@x.com']);
  assert.equal((await (await call('?q=%25', { as: 'adm' })).json()).customers.length, 0);
});

test('detail: orders, payments, inquiries, activity newest first; unknown id 404', async () => {
  const a = addCustomer('ann@x.com', 'Ann');
  const o = addOrder(a, 'completed', 1000);
  db.exec.prepare("INSERT INTO payments (order_id, provider, amount_centavos, status, submitted_at) VALUES (?, 'manual_gcash', 1000, 'confirmed', '2026-01-01 11:00:00')").run(o);
  db.exec.prepare("INSERT INTO order_events (order_id, at, actor, kind, from_status, to_status) VALUES (?, '2026-01-01 12:00:00', 'system', 'status', 'a', 'b')").run(o);
  db.exec.prepare("INSERT INTO inquiries (id, fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt) VALUES ('q', 'Ann', '', 'ANN@x.com', '1', 'Web', 'd', 'email', 'New', '2026-01-01T13:00:00.000Z')").run();
  db.exec.prepare("INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES ('e', 'q', 'Ann@x.com', 'S', 'B', '2026-01-01T14:00:00.000Z', 'admin-reply')").run();
  const d = await (await call(`/${a}`, { as: 'adm' })).json();
  assert.equal(d.orders.length, 1);
  assert.equal(d.orders[0].packageName, 'Standard');
  assert.equal(d.payments[0].orderReference, 'JLC-1');
  assert.deepEqual(d.inquiries.map((i) => i.id), ['q']);
  assert.deepEqual(d.activity.map((x) => x.type), ['email', 'inquiry', 'order_event']);
  assert.equal((await call('/999', { as: 'adm' })).status, 404);
});

test('update: only provided fields, length limits, unknown id 404', async () => {
  const a = addCustomer('ann@x.com', 'Ann');
  assert.equal((await call(`/${a}`, { as: 'adm', body: { phone: ' 0917 ' } })).status, 200);
  assert.deepEqual({ ...db.exec.prepare('SELECT name, phone, notes FROM customers WHERE id = ?').get(a) }, { name: 'Ann', phone: '0917', notes: null });
  assert.equal((await call(`/${a}`, { as: 'adm', body: { name: 'x'.repeat(81) } })).status, 400);
  assert.equal((await call(`/${a}`, { as: 'adm', body: { phone: 'x'.repeat(31) } })).status, 400);
  assert.equal((await call(`/${a}`, { as: 'adm', body: { notes: 'x'.repeat(2001) } })).status, 400);
  assert.equal((await call('/999', { as: 'adm', body: { name: 'Z' } })).status, 404);
});

test('blank name is 400; omitting name is still allowed', async () => {
  const id = addCustomer('z@x.com', 'Zed');
  const res = await call(`/${id}`, { as: 'adm', body: { name: '   ' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Name can't be empty.");
  assert.equal(db.exec.prepare('SELECT name FROM customers WHERE id = ?').get(id).name, 'Zed');
  assert.equal((await call(`/${id}`, { as: 'adm', body: { phone: '0917' } })).status, 200);
});
