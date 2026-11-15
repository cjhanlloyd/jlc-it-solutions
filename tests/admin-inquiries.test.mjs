// Admin inquiries API on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: inquiries } = await bundle('functions/api/admin/inquiries/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
let db;
beforeEach(() => {
  db = makeD1();
  globalThis.SMTP_SENT = [];
  globalThis.SMTP_FAIL = false;
  for (const [name, role] of Object.entries({ boss: 'Super Admin', adm: 'Administrator', ed: 'Editor' })) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
  const pk = (key, kind) => ({ key, name: key, priceCentavos: 99900, inclusions: [], kind });
  const design = db.exec.prepare("INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type, packages, active) VALUES (?, ?, ?, 'classic', 99900, '[]', 'wedding_invitation', ?, ?)");
  design.run(1, 'classic', 'Classic', JSON.stringify([pk('standard', 'template'), pk('bespoke', 'custom')]), 1);
  design.run(2, 'hidden', 'Hidden', JSON.stringify([pk('standard', 'template')]), 0);
});

const smtp = (enabled) => db.exec.prepare("INSERT OR REPLACE INTO smtp_settings (id, host, port, username, password, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, '', '', 'JLC', 'co@x.com', ?)").run(enabled);
const addInquiry = (id, o = {}) => db.exec.prepare(`INSERT INTO inquiries (id, fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt, fileAttachment)
  VALUES (?, ?, '', ?, '0917', 'Web', ?, 'email', ?, ?, ?)`).run(id, o.name ?? 'Eve', o.email ?? 'Eve@X.com', o.desc ?? 'Hello', o.status ?? 'New', o.at ?? '2026-01-01T00:00:00.000Z', o.file ?? null);
const call = async (path, { as, body } = {}) => {
  const headers = as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {};
  return inquiries({ request: new Request('https://shop.test/api/admin/inquiries' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers }),
    env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {} });
};
const row = (id) => db.exec.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);

test('auth: no token 401, Editor 403', async () => {
  addInquiry('a');
  assert.equal((await call('')).status, 401);
  assert.equal((await call('', { as: 'ed' })).status, 403);
  assert.equal((await call('/a', { as: 'ed' })).status, 403);
  assert.equal((await call('/a', { as: 'ed', body: { action: 'delete' } })).status, 403);
  assert.ok(row('a'));
});

test('list: filters, search, counts, custom flag, never the base64', async () => {
  addInquiry('a', { file: JSON.stringify({ name: 'x.png', type: 'image/png', base64: 'data:image/png;base64,AAAA' }) });
  addInquiry('b', { name: 'Zed', desc: 'Custom package request: Gold', status: 'Replied', at: '2026-02-01T00:00:00.000Z' });
  const all = await (await call('', { as: 'adm' })).json();
  assert.deepEqual(all.inquiries.map((i) => i.id), ['b', 'a']);
  assert.equal(all.inquiries[0].isCustomRequest, true);
  assert.equal(all.inquiries[1].isCustomRequest, false);
  assert.equal(all.counts.New, 1);
  assert.equal(all.counts.Replied, 1);
  assert.doesNotMatch(JSON.stringify(all), /AAAA|base64|fileAttachment/);
  assert.deepEqual((await (await call('?status=Replied', { as: 'adm' })).json()).inquiries.map((i) => i.id), ['b']);
  assert.deepEqual((await (await call('?q=zed', { as: 'adm' })).json()).inquiries.map((i) => i.id), ['b']);
});

test('detail: attachment meta, emails, one customer with lowercased email; attachment download', async () => {
  const bytes = Buffer.from('hello-bytes');
  addInquiry('a', { file: JSON.stringify({ name: '../we ird".html', type: 'text/html', base64: `data:text/html;base64,${bytes.toString('base64')}` }) });
  db.exec.prepare("INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES ('e1', 'a', 'eve@x.com', 'S', 'B', 't', 'admin-reply')").run();
  const d = await (await call('/a', { as: 'adm' })).json();
  assert.deepEqual(d.inquiry.attachment, { name: '../we ird".html', type: 'text/html', size: bytes.length });
  assert.doesNotMatch(JSON.stringify(d), /base64|ipAddress/);
  assert.equal(d.emails.length, 1);
  const again = await (await call('/a', { as: 'adm' })).json();
  assert.equal(again.customerId, d.customerId);
  assert.deepEqual(db.exec.prepare('SELECT email, name FROM customers').all().map((c) => ({ ...c })), [{ email: 'eve@x.com', name: 'Eve' }]);
  const res = await call('/a/attachment', { as: 'adm' });
  assert.equal(res.headers.get('Content-Type'), 'application/octet-stream');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.match(res.headers.get('Content-Disposition'), /^attachment; filename="[A-Za-z0-9._-]+"$/);
  assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'hello-bytes');
  assert.equal((await call('/zzz', { as: 'adm' })).status, 404);
  addInquiry('n');
  assert.equal((await call('/n/attachment', { as: 'adm' })).status, 404);
});

test('status, notes, delete with validation and audit rows', async () => {
  addInquiry('a');
  assert.equal((await call('/a', { as: 'adm', body: { action: 'status', status: 'Nope' } })).status, 400);
  assert.equal((await call('/a', { as: 'adm', body: { action: 'status', status: 'Closed' } })).status, 200);
  assert.equal(row('a').status, 'Closed');
  assert.equal((await call('/a', { as: 'adm', body: { action: 'notes', adminNotes: 'x'.repeat(2001) } })).status, 400);
  assert.equal((await call('/a', { as: 'adm', body: { action: 'notes', adminNotes: 'call back' } })).status, 200);
  assert.equal(row('a').adminNotes, 'call back');
  assert.equal((await call('/zzz', { as: 'adm', body: { action: 'notes', adminNotes: 'x' } })).status, 404);
  assert.equal((await call('/a', { as: 'adm', body: { action: 'bogus' } })).status, 400);
  assert.equal((await call('/a', { as: 'adm', body: { action: 'delete' } })).status, 200);
  assert.equal(row('a'), undefined);
  assert.equal(db.exec.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE log_type = 'inquiry'").get().n, 3);
});

test('reply: SMTP off 400; failure 502 and not logged; success mails the inquiry email and moves New to In Progress', async () => {
  addInquiry('a');
  const reply = { action: 'reply', subject: 'Hi', body: 'Hello', to: 'attacker@evil.test' };
  const res = await call('/a', { as: 'adm', body: reply });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'SMTP is disabled or not configured. Cannot send replies.');
  smtp(1);
  assert.equal((await call('/a', { as: 'adm', body: { ...reply, subject: '' } })).status, 400);
  globalThis.SMTP_FAIL = true;
  assert.equal((await call('/a', { as: 'adm', body: reply })).status, 502);
  globalThis.SMTP_FAIL = false;
  assert.equal(db.exec.prepare('SELECT COUNT(*) AS n FROM sent_emails').get().n, 0);
  assert.equal(db.exec.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE log_type = 'system_error'").get().n, 1);
  assert.equal(row('a').status, 'New');
  assert.equal((await call('/a', { as: 'adm', body: reply })).status, 200);
  const sent = db.exec.prepare('SELECT * FROM sent_emails').get();
  assert.equal(sent.to_address, 'Eve@X.com');
  assert.equal(sent.email_type, 'admin-reply');
  assert.match(sent.id, /^eml-/);
  assert.equal(row('a').status, 'In Progress');
  assert.doesNotMatch(globalThis.SMTP_SENT.join(''), /attacker/);
});

test('send-order-link: validates design and template package, then emails and converts', async () => {
  addInquiry('a');
  const link = (designSlug, packageKey) => call('/a', { as: 'adm', body: { action: 'send-order-link', designSlug, packageKey } });
  smtp(1);
  assert.equal((await link('classic', 'bespoke')).status, 400, 'custom package');
  assert.equal((await link('classic', 'nope')).status, 400, 'unknown package');
  assert.equal((await link('hidden', 'standard')).status, 400, 'inactive design');
  assert.equal((await link('missing', 'standard')).status, 400, 'unknown design');
  assert.equal(row('a').status, 'New');
  smtp(0);
  assert.equal((await link('classic', 'standard')).status, 400, 'SMTP off');
  assert.equal(row('a').status, 'New');
  smtp(1);
  assert.equal((await link('classic', 'standard')).status, 200);
  const sent = db.exec.prepare('SELECT * FROM sent_emails').get();
  assert.equal(sent.email_type, 'order-link');
  assert.match(sent.body, /https:\/\/shop\.test\/designs\/classic\/customise\?package=standard/);
  assert.equal(row('a').status, 'Converted');
});

test('isCustomRequest is case-sensitive in both the list and the detail', async () => {
  addInquiry('a', { desc: 'custom package request: gold' });
  addInquiry('b', { desc: 'Custom package request: gold', at: '2026-02-01T00:00:00.000Z' });
  const l = await (await call('', { as: 'adm' })).json();
  assert.deepEqual(l.inquiries.map((i) => [i.id, i.isCustomRequest]), [['b', true], ['a', false]]);
  assert.equal((await (await call('/a', { as: 'adm' })).json()).inquiry.isCustomRequest, false);
  assert.equal((await (await call('/b', { as: 'adm' })).json()).inquiry.isCustomRequest, true);
});
