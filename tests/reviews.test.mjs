// Customer reviews: account API (sign-in, delivered order, upsert, rate limit), public list, admin moderation, rendering as text.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: account } = await bundle('functions/api/account/[[path]].ts');
const { onRequestGet: publicList } = await bundle('functions/api/reviews.ts');
const { onRequest: admin } = await bundle('functions/api/admin/reviews/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const { averageRating, validateReview } = await bundle('shared/reviews.ts');
const { ReviewCard, Stars } = await bundle('src/site/Stars.tsx');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) {
    const form = new URLSearchParams(init.body);
    return Response.json({ success: form.get('response') === 'good-token' });
  }
  throw new Error('Unexpected fetch ' + url);
};

const SECRET = 'jwt-secret';
const TEXT = 'Beautiful invitation, our guests loved it so much!';
let db;
beforeEach(() => {
  db = makeD1();
  for (const [n, role] of [['boss', 'Super Admin'], ['adm', 'Administrator'], ['ed', 'Editor']]) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${n}@jlc.test`, n, role);
  }
});
const sql = (s, ...a) => db.exec.prepare(s).run(...a);
const q = (s, ...a) => db.exec.prepare(s).all(...a);

function customer(email, { delivered = true, name = 'Maria Santos' } = {}) {
  sql('INSERT INTO customers (email, name) VALUES (?, ?)', email, name);
  sql('INSERT INTO customer_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)', createHash('sha256').update('tok-' + email).digest('hex'), email, '2999-01-01T00:00:00.000Z');
  sql("INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference) VALUES (0, ?, 99900, ?, ?)", email, delivered ? 'delivered' : 'in_production', 'JLC-' + email);
  return 'tok-' + email;
}
const env = () => ({ DB: db, TURNSTILE_SECRET_KEY: 's', JWT_SECRET: SECRET });
const acct = (method, path, token, body) => account({ request: new Request('https://shop.test' + path, { method, headers: token ? { 'X-Customer-Token': token } : {}, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) }), env: env(), waitUntil() {} });
const form = (patch = {}) => ({ rating: 5, body: TEXT, displayName: 'Maria S.', turnstileToken: 'good-token', ...patch });
const save = (token, patch) => acct('POST', '/api/account/review', token, form(patch));
const pub = async (qs = '') => (await publicList({ request: new Request('https://shop.test/api/reviews' + qs), env: env() })).json();
const adm = async (as, method, path, body) => admin({
  request: new Request('https://shop.test' + path, { method, body: method === 'GET' ? undefined : JSON.stringify(body), headers: as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {} }), env: env(), waitUntil() {},
});

test('not signed in: 401 on every review route', async () => {
  for (const [m, p] of [['GET', '/api/account/review'], ['POST', '/api/account/review'], ['POST', '/api/account/review/delete']]) assert.equal((await acct(m, p, null, {})).status, 401);
});

test('without a delivered order: not eligible, 403 on submit', async () => {
  const t = customer('a@x.com', { delivered: false });
  assert.deepEqual(await (await acct('GET', '/api/account/review', t)).json(), { eligible: false, review: null, suggestedName: 'Maria Santos' });
  const res = await save(t);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Reviews are open to customers with a delivered invitation.');
  assert.equal(q('SELECT * FROM reviews').length, 0);
});

test('eligible customer: review is pending, a second submit updates the one row and returns to pending', async () => {
  const t = customer('a@x.com');
  assert.equal((await (await acct('GET', '/api/account/review', t)).json()).eligible, true);
  const first = await (await save(t)).json();
  assert.equal(first.review.status, 'pending');
  sql("UPDATE reviews SET status = 'approved', moderated_at = 'x'");
  const second = await (await save(t, { rating: 3, body: 'Changed my mind, it was fine overall really.' })).json();
  assert.equal(second.review.status, 'pending');
  assert.equal(second.review.rating, 3);
  assert.equal(q('SELECT * FROM reviews').length, 1);
  assert.equal((await (await acct('GET', '/api/account/review', t)).json()).review.body, 'Changed my mind, it was fine overall really.');
  assert.equal((await acct('POST', '/api/account/review/delete', t, {})).status, 200);
  assert.equal(q('SELECT * FROM reviews').length, 0);
});

test('validation and Turnstile', async () => {
  const t = customer('a@x.com');
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: '5' }, { body: 'too short' }, { body: 'x'.repeat(1001) }, { displayName: '  ' }, { displayName: 'n'.repeat(61) }]) {
    assert.equal((await save(t, patch)).status, 400, JSON.stringify(patch).slice(0, 40));
  }
  assert.equal((await save(t, { turnstileToken: 'bad' })).status, 400);
  assert.equal(q('SELECT * FROM reviews').length, 0);
  assert.equal(validateReview(form({ body: 'a\u0000b' + 'c'.repeat(30), displayName: 'M\nS' })).value.displayName, 'M S');
});

test('rate limit: the 6th save in an hour is refused', async () => {
  const t = customer('a@x.com');
  for (let i = 0; i < 5; i++) assert.equal((await save(t)).status, 200);
  assert.equal((await save(t)).status, 429);
});

test('public list: approved only, newest first, no emails, limit and average', async () => {
  const ta = customer('a@x.com'), tb = customer('b@x.com'), tc = customer('c@x.com');
  await save(ta, { rating: 5, displayName: 'Ann' }); await save(tb, { rating: 4, displayName: 'Bea' }); await save(tc, { rating: 1, displayName: 'Cy' });
  assert.deepEqual(await pub(), { average: null, count: 0, reviews: [] });
  sql("UPDATE reviews SET status = 'approved', moderated_at = '2026-11-01T00:00:00.000Z' WHERE display_name = 'Ann'");
  sql("UPDATE reviews SET status = 'approved', moderated_at = '2026-11-02T00:00:00.000Z' WHERE display_name = 'Bea'");
  sql("UPDATE reviews SET status = 'rejected' WHERE display_name = 'Cy'");
  const d = await pub();
  assert.equal(d.average, 4.5);
  assert.equal(d.count, 2);
  assert.deepEqual(d.reviews.map((r) => r.displayName), ['Bea', 'Ann']);
  assert.deepEqual(Object.keys(d.reviews[0]).sort(), ['body', 'date', 'displayName', 'rating']);
  assert.ok(!JSON.stringify(d).includes('@'));
  assert.equal((await pub('?limit=1')).reviews.length, 1);
});

test('admin: approve, reject with reason, delete; audit rows; pending count', async () => {
  const t = customer('a@x.com');
  await save(t);
  const id = q('SELECT id FROM reviews')[0].id;
  const d = await (await adm('adm', 'GET', '/api/admin/reviews')).json();
  assert.equal(d.pendingCount, 1);
  assert.equal(d.reviews[0].customerEmail, 'a@x.com');
  assert.equal((await adm('adm', 'POST', '/api/admin/reviews', { action: 'reject', id, reason: 'x'.repeat(301) })).status, 400);
  assert.equal((await adm('adm', 'POST', '/api/admin/reviews', { action: 'reject', id, reason: 'Please remove the phone number.' })).status, 200);
  const rej = (await (await acct('GET', '/api/account/review', t)).json()).review;
  assert.equal(rej.status, 'rejected');
  assert.equal(rej.rejectReason, 'Please remove the phone number.');
  assert.equal((await pub()).count, 0);
  assert.equal((await adm('boss', 'POST', '/api/admin/reviews', { action: 'approve', id })).status, 200);
  assert.equal(q('SELECT moderated_by FROM reviews')[0].moderated_by, 'boss@jlc.test');
  assert.equal((await pub()).count, 1);
  assert.equal((await adm('adm', 'GET', '/api/admin/reviews?status=approved')).status, 200);
  assert.equal((await adm('adm', 'POST', '/api/admin/reviews', { action: 'delete', id })).status, 200);
  assert.equal((await adm('adm', 'POST', '/api/admin/reviews', { action: 'delete', id })).status, 404);
  assert.equal(q("SELECT * FROM audit_logs WHERE log_type = 'review'").length, 3);
});

test('admin: needs reviews.manage', async () => {
  assert.equal((await adm(null, 'GET', '/api/admin/reviews')).status, 401);
  assert.equal((await adm('ed', 'GET', '/api/admin/reviews')).status, 403);
  assert.equal((await adm('ed', 'POST', '/api/admin/reviews', { action: 'approve', id: 1 })).status, 403);
});

test('"<script>" is stored and returned as text, and rendered as a text node', async () => {
  const t = customer('a@x.com');
  const body = 'Loved it <script>alert(1)</script> & more words here';
  await save(t, { body });
  sql("UPDATE reviews SET status = 'approved', moderated_at = '2026-11-01T00:00:00.000Z'");
  const r = (await pub()).reviews[0];
  assert.equal(r.body, body);
  const html = renderToStaticMarkup(createElement(ReviewCard, { r }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(renderToStaticMarkup(createElement(Stars, { rating: 4 })).includes('aria-label="Rated 4 out of 5"'));
});

test('averageRating rounds to one decimal', () => {
  assert.equal(averageRating(0, 0), null);
  assert.equal(averageRating(14, 3), 4.7);
  assert.equal(averageRating(9, 2), 4.5);
  assert.equal(averageRating(5, 1), 5);
});
