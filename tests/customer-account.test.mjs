// Tests for customer sign-in (emailed code), the dashboard list and the session way into the manage API. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: account } = await bundle('functions/api/account/[[path]].ts');
const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) {
    const form = new URLSearchParams(init.body);
    return Response.json({ success: form.get('secret') === 'turnstile-secret' && form.get('response') === 'good-token' });
  }
  throw new Error('Unexpected fetch ' + url);
};

const hash = (s) => createHash('sha256').update(s).digest('hex');
const SCHEME = JSON.stringify({ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' });
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } };
const BAD = 'That code is not valid or has expired. Request a new one.';

let db, r2, background;
beforeEach(() => {
  db = makeD1(); r2 = makeR2(); background = []; globalThis.SMTP_SENT = [];
  db.exec.exec(`
    INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type)
      VALUES (1, 'classic', 'Classic Elegance', 'classic', 99900, '[${SCHEME}]', 1, 0, 'wedding_invitation');
    INSERT INTO smtp_settings (id, host, port, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, 'JLC', 'co@x.com', 1);`);
});
const sql = (s, ...a) => db.exec.prepare(s).run(...a);
const q = (s, ...a) => db.exec.prepare(s).all(...a);
const settle = () => Promise.all(background.splice(0));
const ctx = (request) => ({ request, env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret' }, waitUntil(p) { background.push(p); } });
const call = (fn, method, path, body, headers = {}) => fn(ctx(new Request('https://shop.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })));
const reqCode = (email) => call(account, 'POST', '/api/account/code', { email, turnstileToken: 'good-token' });
const mails = () => globalThis.SMTP_SENT.filter((t) => t.startsWith('Message-ID')).map((t) => t.replace(/=\r\n/g, ''));
const lastCode = () => mails().at(-1).match(/\b(\d{6})\b/)[1];
const verify = (email, code) => call(account, 'POST', '/api/account/verify', { email, code });
const signIn = async (email) => {
  await reqCode(email); await settle();
  return (await (await verify(email, lastCode())).json()).token;
};
const list = (token) => call(account, 'GET', '/api/account', undefined, token ? { 'X-Customer-Token': token } : {});

// invitation id, owner email, order status, invitation status
function seed(id, email, orderStatus = 'delivered', invStatus = 'live') {
  sql(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier)
    VALUES (?, 1, ?, ?, ?, '[]', ?, '2027-06-12', ?, 'premium')`, id, `maria-${id}`, SCHEME, JSON.stringify(details), invStatus, hash(`mt-${id}`));
  sql(`INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, package_name, created_at) VALUES (?, ?, 99900, ?, ?, 'Premium', ?)`, id, email, orderStatus, `JLC-${id}`, `2026-11-0${id} 08:00:00`);
}

test('request code: same answer with or without orders; one 6-digit code emailed', async () => {
  seed(1, 'bride@example.com');
  const a = await reqCode('Bride@Example.com');
  const b = await reqCode('nobody@example.com');
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(await a.text(), await b.text());
  await settle();
  assert.equal(mails().length, 2);
  assert.ok(mails()[0].includes('Subject: Your sign-in code'));
  assert.match(mails()[0], /\b\d{6}\b/);
  assert.ok(mails()[0].includes('10 minutes'));
  assert.equal(q('SELECT * FROM customer_login_codes').length, 2);
  assert.ok(!JSON.stringify(q('SELECT * FROM customer_login_codes')).includes(lastCode()));
});

test('request code: bad Turnstile 400; the 4th request in an hour sends nothing', async () => {
  assert.equal((await call(account, 'POST', '/api/account/code', { email: 'a@b.co', turnstileToken: 'bad' })).status, 400);
  for (let n = 0; n < 4; n++) assert.deepEqual(await (await reqCode('a@b.co')).json(), { ok: true });
  await settle();
  assert.equal(mails().length, 3);
});

test('verify: right code gives a token and creates the customer; the code works once', async () => {
  await reqCode('new@example.com'); await settle();
  const code = lastCode();
  const res = await verify('NEW@example.com', code);
  assert.equal(res.status, 200);
  const { token, email } = await res.json();
  assert.equal(email, 'new@example.com');
  assert.equal(q('SELECT email FROM customers')[0].email, 'new@example.com');
  assert.equal(q('SELECT token_hash FROM customer_sessions')[0].token_hash, hash(token));
  const again = await verify('new@example.com', code);
  assert.equal(again.status, 400);
  assert.equal((await again.json()).error, BAD);
});

test('verify: five wrong codes lock it, even the right code fails afterwards', async () => {
  await reqCode('a@b.co'); await settle();
  const right = lastCode();
  const wrong = right === '000000' ? '111111' : '000000';
  for (let n = 0; n < 5; n++) assert.equal((await verify('a@b.co', wrong)).status, 400);
  const res = await verify('a@b.co', right);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, BAD);
});

test('verify: expired code and unknown email fail', async () => {
  await reqCode('a@b.co'); await settle();
  sql("UPDATE customer_login_codes SET expires_at = '2020-01-01T00:00:00.000Z'");
  assert.equal((await verify('a@b.co', lastCode())).status, 400);
  assert.equal((await verify('none@b.co', '123456')).status, 400);
});

test('account: lists only that email orders, newest first; live has a slug, pending has none', async () => {
  seed(1, 'bride@example.com');
  seed(2, 'bride@example.com', 'pending_payment', 'pending');
  seed(3, 'other@example.com');
  const token = await signIn('bride@example.com');
  const data = await (await list(token)).json();
  assert.equal(data.email, 'bride@example.com');
  assert.deepEqual(data.orders.map((o) => o.reference), ['JLC-2', 'JLC-1']);
  const [pending, liveOrder] = data.orders;
  assert.equal(liveOrder.slug, 'maria-1'); assert.equal(liveOrder.live, true);
  assert.equal(liveOrder.statusLabel, 'Delivered'); assert.equal(liveOrder.tier, 'premium');
  assert.equal(liveOrder.designName, 'Classic Elegance'); assert.equal(liveOrder.eventDate, '2027-06-12');
  assert.equal(liveOrder.invitationId, 1); assert.ok(liveOrder.title);
  assert.ok(!('slug' in pending) && !('live' in pending));
  assert.ok(!JSON.stringify(data).includes(hash('mt-1')));
});

test('account: no, bad or expired session gets 401; logout ends the session', async () => {
  assert.equal((await list()).status, 401);
  assert.equal((await list('nope')).status, 401);
  const token = await signIn('a@b.co');
  assert.equal((await list(token)).status, 200);
  sql("UPDATE customer_sessions SET expires_at = '2020-01-01T00:00:00.000Z'");
  assert.equal((await list(token)).status, 401);
  sql("UPDATE customer_sessions SET expires_at = '2999-01-01T00:00:00.000Z'");
  assert.equal((await list(token)).status, 200);
  const out = await call(account, 'POST', '/api/account/logout', undefined, { 'X-Customer-Token': token });
  assert.deepEqual(await out.json(), { ok: true });
  assert.equal((await list(token)).status, 401);
});

const manage = (method, token, id, body) => call(invitations, method, '/api/invitations/manage', body,
  { 'X-Customer-Token': token, ...(id === undefined ? {} : { 'X-Invitation-Id': String(id) }) });

test('manage by session: own live delivered invitation works for GET and edit', async () => {
  seed(1, 'bride@example.com');
  const token = await signIn('bride@example.com');
  const res = await manage('GET', token, 1);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).slug, 'maria-1');
  const edit = await manage('POST', token, 1, { details: { ...details, eventDate: '2027-07-01' }, photos: [] });
  assert.equal(edit.status, 200, await edit.clone().text());
  assert.equal(JSON.parse(q('SELECT details FROM invitations WHERE id = 1')[0].details).eventDate, '2027-07-01');
});

test('manage by session: foreign, undelivered, not live, missing or malformed ids all get the same 404', async () => {
  seed(1, 'bride@example.com');
  seed(2, 'other@example.com');
  seed(3, 'bride@example.com', 'in_production', 'live');
  seed(4, 'bride@example.com', 'delivered', 'expired');
  const token = await signIn('bride@example.com');
  const bodies = new Set();
  for (const id of [2, 3, 4, 99, undefined, '1abc', '-1', '01']) {
    const res = await manage('GET', token, id);
    assert.equal(res.status, 404, `id ${id}`);
    bodies.add(await res.text());
  }
  assert.equal((await manage('POST', token, 2, { details, photos: [] })).status, 404);
  assert.equal((await manage('GET', 'bad-token', 1)).status, 404);
  assert.equal(bodies.size, 1);
});

test('manage token path still works', async () => {
  seed(1, 'bride@example.com');
  const res = await call(invitations, 'GET', '/api/invitations/manage', undefined, { 'X-Manage-Token': 'mt-1' });
  assert.equal(res.status, 200);
});

test('verify: 10 parallel wrong guesses then the right code still fails', async () => {
  await reqCode('a@b.co'); await settle();
  const right = lastCode();
  const wrongs = Array.from({ length: 10 }, (_, n) => String(n).repeat(6)).filter((c) => c !== right);
  await Promise.all(wrongs.map((c) => verify('a@b.co', c)));
  assert.equal(q('SELECT attempts FROM customer_login_codes')[0].attempts, 5);
  assert.equal((await verify('a@b.co', right)).status, 400);
});

test('verify: two parallel correct submissions give exactly one session', async () => {
  await reqCode('a@b.co'); await settle();
  const code = lastCode();
  const res = await Promise.all([verify('a@b.co', code), verify('a@b.co', code)]);
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 400]);
  assert.equal(q('SELECT * FROM customer_sessions').length, 1);
});

test('mixed-case customer_email on an order still matches the session email', async () => {
  seed(1, 'Bride@Example.com');
  const token = await signIn('bride@example.com');
  assert.equal((await (await list(token)).json()).orders.length, 1);
  assert.equal((await manage('GET', token, 1)).status, 200);
});
