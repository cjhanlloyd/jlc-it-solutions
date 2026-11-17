// Email settings API: Super Admin only, password never returned, empty keeps, clear clears, test errors masked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest } = await bundle('functions/api/admin/email/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
const PW = 'S3cret-pass-XYZ';
const db = makeD1();
for (const [name, role] of Object.entries({ boss: 'Super Admin', adm: 'Administrator' }))
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
db.exec.exec('DELETE FROM smtp_settings; DELETE FROM email_template');

const call = async (as, body) => onRequest({
  request: new Request('https://x.test/api/admin/email', { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }),
  env: { DB: db, JWT_SECRET: SECRET },
});
const smtp = { section: 'smtp', host: 'smtp.x', port: 587, username: 'u', senderName: 'JLC', senderEmail: 'no-reply@jlc.test', signature: 'Sig', enabled: false };
const stored = () => db.exec.prepare("SELECT password FROM smtp_settings WHERE id = 'default'").get().password;

test('Administrator gets 403', async () => {
  assert.equal((await call('adm')).status, 403);
  assert.equal((await call('adm', smtp)).status, 403);
});

test('GET works on empty tables; save creates rows; password never returned', async () => {
  assert.equal((await call('boss')).status, 200);
  assert.equal((await call('boss', { ...smtp, password: PW })).status, 200);
  const res = await call('boss');
  const text = await res.text();
  assert.ok(!text.includes(PW));
  const j = JSON.parse(text);
  assert.ok(!('password' in j.smtp));
  assert.equal(j.smtp.passwordSet, true);
  assert.equal(j.smtp.host, 'smtp.x');
});

test('empty password keeps stored; clearPassword empties', async () => {
  assert.equal((await call('boss', { ...smtp, password: '' })).status, 200);
  assert.equal(stored(), PW);
  assert.equal((await call('boss', { ...smtp, clearPassword: true })).status, 200);
  assert.equal(stored(), '');
  assert.equal((await (await call('boss')).json()).smtp.passwordSet, false);
});

test('template saves with limits', async () => {
  assert.equal((await call('boss', { section: 'template', subject: 'Hi', body: 'Dear {{name}}' })).status, 200);
  assert.deepEqual((await (await call('boss')).json()).template, { subject: 'Hi', body: 'Dear {{name}}' });
  assert.equal((await call('boss', { section: 'template', subject: 'x'.repeat(151), body: 'b' })).status, 400);
  assert.equal((await call('boss', { section: 'template', subject: 's', body: 'x'.repeat(5001) })).status, 400);
});

test('test email: sends even when disabled; failure is 502 and never contains the password', async () => {
  globalThis.SMTP_SENT = [];
  assert.equal((await call('boss', { section: 'test' })).status, 200);
  assert.match(globalThis.SMTP_SENT.join(''), /boss@jlc\.test/);
  await call('boss', { ...smtp, password: PW });
  globalThis.SMTP_FAIL = true;
  globalThis.SMTP_FAIL_MSG = `auth failed for password ${PW}`;
  const res = await call('boss', { section: 'test' });
  globalThis.SMTP_FAIL = false;
  const text = await res.text();
  assert.equal(res.status, 502);
  assert.ok(!text.includes(PW));
  assert.match(text, /•••/);
});

test('enabled: boolean or 0/1 only ("false" is off); port must be an integer 1-65535', async () => {
  const enabled = async (v) => { assert.equal((await call('boss', { ...smtp, enabled: v })).status, 200); return (await (await call('boss')).json()).smtp.enabled; };
  assert.equal(await enabled('false'), false);
  assert.equal(await enabled('true'), false);
  assert.equal(await enabled(1), true);
  assert.equal(await enabled(0), false);
  assert.equal(await enabled(true), true);
  assert.equal(await enabled(false), false);
  for (const port of [0, 65536, 1.5, '', null, true, 'abc', [587]]) assert.equal((await call('boss', { ...smtp, port })).status, 400, String(port));
  for (const port of [1, 65535, '587']) assert.equal((await call('boss', { ...smtp, port })).status, 200, String(port));
});

test('orderAlertEmail round-trips, trims, may be empty, and is validated', async () => {
  const save = (v) => call('boss', { ...smtp, orderAlertEmail: v });
  assert.equal((await save('  alerts@jlc.test ')).status, 200);
  assert.equal((await (await call('boss')).json()).smtp.orderAlertEmail, 'alerts@jlc.test');
  assert.equal((await save('')).status, 200);
  assert.equal((await (await call('boss')).json()).smtp.orderAlertEmail, '');
  assert.equal((await save('not-an-email')).status, 400);
  assert.equal((await save('a'.repeat(250) + '@x.co')).status, 400);
});
