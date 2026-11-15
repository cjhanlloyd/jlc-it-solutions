// Admin users API and invite/reset hardening on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: users } = await bundle('functions/api/admin/users/[[path]].ts');
const { onRequest: orders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { onRequest: route } = await bundle('functions/api/[[route]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
const hash = bcrypt.hashSync('pw', 4);
let db;
const add = (name, role, status = 'Active', verified = 1) =>
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, 't')").run(`${name}@jlc.test`, name, role, status, verified, hash);
beforeEach(() => {
  db = makeD1();
  add('boss', 'Super Admin'); add('adm', 'Administrator'); add('ed', 'Editor');
});

const env = () => ({ DB: db, JWT_SECRET: SECRET });
const tok = async (as) => ({ Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) });
const call = async (path, { as, body } = {}) => users({
  request: new Request('https://shop.test/api/admin/users' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: as ? await tok(as) : {} }),
  env: env(), waitUntil() {},
});
const post = (email, action, extra = {}, as = 'boss') => call('/' + encodeURIComponent(email), { as, body: { action, ...extra } });
const invite = (body) => call('', { as: 'boss', body: { action: 'invite', ...body } });
const row = (name) => db.exec.prepare('SELECT * FROM admins WHERE email = ?').get(`${name}@jlc.test`);
const open = (path, body) => route({ request: new Request('https://shop.test' + path, { method: 'POST', body: JSON.stringify(body) }), env: env(), waitUntil() {} });

test('only Super Admin; list returns users and me', async () => {
  assert.equal((await call('')).status, 401);
  for (const as of ['adm', 'ed']) {
    assert.equal((await call('', { as })).status, 403);
    assert.equal((await post('boss@jlc.test', 'disable', {}, as)).status, 403);
  }
  const r = await (await call('', { as: 'boss' })).json();
  assert.equal(r.me, 'boss@jlc.test');
  assert.equal(r.users.length, 3);
  assert.equal(r.users[0].verified, true);
});

test('sole Super Admin cannot demote, disable or delete themselves; with a second one the other can', async () => {
  for (const [a, x] of [['role', { role: 'Editor' }], ['disable'], ['delete']]) {
    assert.equal((await post('boss@jlc.test', a, x)).status, 409, a);
  }
  assert.equal(row('boss').role, 'Super Admin');
  add('boss2', 'Super Admin');
  for (const [a, x] of [['role', { role: 'Editor' }], ['disable'], ['delete']]) {
    assert.equal((await post('boss2@jlc.test', a, x, 'boss2')).status, 409, 'self ' + a);
  }
  assert.equal((await post('boss@jlc.test', 'role', { role: 'Editor' }, 'boss2')).status, 200);
  assert.equal(row('boss').role, 'Editor');
});

test('invite: SMTP off returns a link; duplicates 409; validation 400', async () => {
  const r = await invite({ email: 'New@X.com', fullName: 'New', role: 'Editor' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.emailed, false);
  assert.match(j.inviteLink, /\/admin#\/invite\?email=new%40x\.com&token=/);
  assert.equal(db.exec.prepare("SELECT status FROM admins WHERE email='new@x.com'").get().status, 'Invited');
  assert.equal((await invite({ email: 'new@x.com', fullName: 'N', role: 'Editor' })).status, 409);
  assert.equal((await invite({ email: 'a@x.com', fullName: 'N', role: 'Owner' })).status, 400);
  assert.equal((await invite({ email: 'a@x.com', fullName: 'x'.repeat(81), role: 'Editor' })).status, 400);
});

test('enable, resend-invite and send-reset state rules', async () => {
  await invite({ email: 'new@x.com', fullName: 'New', role: 'Editor' });
  assert.equal((await post('new@x.com', 'enable')).status, 409);
  const token = () => db.exec.prepare("SELECT verificationToken FROM admins WHERE email='new@x.com'").get().verificationToken;
  const before = token();
  assert.equal((await post('new@x.com', 'resend-invite')).status, 200);
  assert.notEqual(token(), before);
  assert.equal((await post('ed@jlc.test', 'resend-invite')).status, 409);
  assert.equal((await post('new@x.com', 'send-reset')).status, 409);
  const off = await post('ed@jlc.test', 'send-reset');
  assert.equal(off.status, 400);
  assert.match((await off.json()).error, /Email is off/);
  assert.equal((await post('ghost@x.com', 'disable')).status, 404);
  assert.equal((await post('ed@jlc.test', 'bogus')).status, 400);
  assert.equal((await post('ed@jlc.test', 'role', { role: 'Nope' })).status, 400);
});

test('disable revokes the token; enable restores; actions are audited as security', async () => {
  const headers = await tok('ed');
  const ord = () => orders({ request: new Request('https://shop.test/api/admin/orders', { headers }), env: env(), waitUntil() {} });
  assert.equal((await ord()).status, 200);
  assert.equal((await post('ed@jlc.test', 'disable')).status, 200);
  assert.equal((await ord()).status, 401);
  assert.equal((await post('ed@jlc.test', 'enable')).status, 200);
  assert.equal((await ord()).status, 200);
  assert.equal((await post('ed@jlc.test', 'role', { role: 'Administrator' })).status, 200);
  assert.equal(row('ed').role, 'Administrator');
  assert.equal(db.exec.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE log_type='security'").get().n, 3);
});

test('delete unassigns orders', async () => {
  db.exec.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, assigned_to) VALUES (1, 'x', 1, 'paid', 'R1', 'manual_gcash', 'ed@jlc.test')").run();
  assert.equal((await post('ed@jlc.test', 'delete')).status, 200);
  assert.equal(row('ed'), undefined);
  assert.equal(db.exec.prepare("SELECT assigned_to FROM orders WHERE reference='R1'").get().assigned_to, null);
});

test('reset-password and verify-invite: 10 chars minimum; Disabled refused; forgot stays generic', async () => {
  db.exec.prepare("UPDATE admins SET resetToken='t1', resetTokenExpires='2999-01-01T00:00:00Z' WHERE email='ed@jlc.test'").run();
  const body = (password) => ({ email: 'ed@jlc.test', token: 't1', password });
  assert.equal((await open('/api/admin/reset-password', body('123456789'))).status, 400);
  db.exec.prepare("UPDATE admins SET status='Disabled' WHERE email='ed@jlc.test'").run();
  assert.equal((await open('/api/admin/reset-password', body('1234567890'))).status, 400);
  db.exec.prepare("UPDATE admins SET status='Active' WHERE email='ed@jlc.test'").run();
  assert.equal((await open('/api/admin/reset-password', body('1234567890'))).status, 200);

  add('inv', 'Editor', 'Invited', 0);
  db.exec.prepare("UPDATE admins SET verificationToken='v1' WHERE email='inv@jlc.test'").run();
  assert.equal((await open('/api/admin/verify-invite', { email: 'inv@jlc.test', token: 'v1', password: 'short' })).status, 400);
  assert.equal((await open('/api/admin/verify-invite', { email: 'inv@jlc.test', token: 'v1', password: 'longenough1' })).status, 200);

  db.exec.prepare("UPDATE admins SET status='Disabled' WHERE email='adm@jlc.test'").run();
  assert.equal((await open('/api/admin/forgot-password', { email: 'adm@jlc.test' })).status, 200);
  assert.equal(row('adm').resetToken, null);
});

test('disabling an Invited user revokes the invite token', async () => {
  const j = await (await invite({ email: 'new@x.com', fullName: 'New', role: 'Editor' })).json();
  const token = new URL(j.inviteLink.replace('#', '')).searchParams.get('token');
  assert.equal((await post('new@x.com', 'disable')).status, 200);
  assert.equal((await open('/api/admin/verify-invite', { email: 'new@x.com', token, password: 'longenough1' })).status, 400);
  assert.equal(db.exec.prepare("SELECT status FROM admins WHERE email='new@x.com'").get().status, 'Disabled');
});

test('forgot-password and reset-password accept a mixed-case email', async () => {
  assert.equal((await open('/api/admin/forgot-password', { email: 'Ed@JLC.test ' })).status, 200);
  const t = row('ed').resetToken;
  assert.ok(t);
  assert.equal((await open('/api/admin/reset-password', { email: 'ED@jlc.test', token: t, password: '1234567890' })).status, 200);
});

test('verify-invite accepts a mixed-case email', async () => {
  add('inv', 'Editor', 'Invited', 0);
  db.exec.prepare("UPDATE admins SET verificationToken='v1' WHERE email='inv@jlc.test'").run();
  assert.equal((await open('/api/admin/verify-invite', { email: 'INV@jlc.test', token: 'v1', password: 'longenough1' })).status, 200);
});

test('resend-invite is refused for a Disabled account', async () => {
  add('dis', 'Editor', 'Disabled', 0);
  assert.equal((await post('dis@jlc.test', 'resend-invite')).status, 409);
  assert.equal(row('dis').verificationToken, null);
});

const smtpOn = () => db.exec.prepare("INSERT OR REPLACE INTO smtp_settings (id, host, port, username, password, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, '', '', 'JLC', 'co@x.com', 1)").run();

test('invite: link and line break stripped from the name; blank after cleaning is 400', async () => {
  smtpOn();
  globalThis.SMTP_SENT = [];
  const r = await invite({ email: 'ana@x.com', fullName: 'Ana\nhttps://evil.example', role: 'Editor' });
  assert.equal(r.status, 200);
  assert.equal(db.exec.prepare("SELECT fullName FROM admins WHERE email='ana@x.com'").get().fullName, 'Ana');
  const mail = globalThis.SMTP_SENT.join('');
  assert.doesNotMatch(mail, /evil\.example/);
  assert.match(mail, /Dear Ana,</);
  assert.equal((await invite({ email: 'b@x.com', fullName: 'https://evil.example', role: 'Editor' })).status, 400);
  assert.equal((await invite({ email: 'c@x.com', fullName: 'x'.repeat(81), role: 'Editor' })).status, 400);
});

test('resend-invite cleans a bad name already stored', async () => {
  smtpOn();
  add('old', 'Editor', 'Invited', 0);
  db.exec.prepare("UPDATE admins SET fullName = ? WHERE email='old@jlc.test'").run('Ola\r\nhttp://evil.example/x');
  globalThis.SMTP_SENT = [];
  assert.equal((await post('old@jlc.test', 'resend-invite')).status, 200);
  const mail = globalThis.SMTP_SENT.join('');
  assert.doesNotMatch(mail, /evil\.example/);
  assert.match(mail, /Dear Ola,</);
});

test('completed password reset writes a security audit row', async () => {
  db.exec.prepare("UPDATE admins SET resetToken='t1', resetTokenExpires='2999-01-01T00:00:00Z' WHERE email='ed@jlc.test'").run();
  assert.equal((await open('/api/admin/reset-password', { email: 'ed@jlc.test', token: 't1', password: '1234567890' })).status, 200);
  const r = db.exec.prepare("SELECT log_type, message FROM audit_logs WHERE message LIKE '%reset their password%'").all();
  assert.deepEqual(r.map((x) => ({ ...x })), [{ log_type: 'security', message: 'ed@jlc.test reset their password' }]);
});
