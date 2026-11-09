// Tests for the invitation checkout API and the PayMongo webhook. Run: npm test
// Both handlers are bundled with esbuild; D1, R2, SMTP, Turnstile and PayMongo are in-memory fakes.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
let invitations, webhook;
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jlc-inv-'));
  const bundle = async (entry, name) => {
    const outfile = join(dir, name);
    await build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm',
      outfile, logLevel: 'warning', alias: { 'cloudflare:sockets': join(root, 'tests/smtp-stub.mjs') } });
    return import(pathToFileURL(outfile).href);
  };
  invitations = (await bundle('functions/api/invitations/[[path]].ts', 'inv.mjs')).onRequest;
  webhook = (await bundle('functions/api/paymongo/webhook.ts', 'hook.mjs')).onRequestPost;
});

// --- In-memory D1: answers only the statements the two handlers issue ---
const design = { id: 1, slug: 'classic-elegance', name: 'Classic Elegance', layout_key: 'classic', price_centavos: 99900,
  color_schemes: JSON.stringify([{ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' }]),
  preview_images: '[]', sample_details: '{}', active: 1, sort_order: 0 };
let db;
beforeEach(() => {
  db = { designs: [design, { ...design, id: 2, slug: 'hidden', active: 0 }], invitations: [], orders: [], events: [] };
  globalThis.SMTP_SENT = [];
  r2.clear();
  paymongoCalls.length = 0;
  paymongoFails = false;
});
const row = (t, id) => db[t].find(r => r.id === id);
function exec(sql, a) {
  let m;
  if (/FROM products_designs WHERE active = 1/.test(sql)) return { results: db.designs.filter(d => d.active) };
  if (/FROM products_designs WHERE slug = \? AND active = 1/.test(sql)) return db.designs.find(d => d.slug === a[0] && d.active) ?? null;
  if (/^INSERT INTO invitations/.test(sql)) {
    const id = db.invitations.length + 1;
    db.invitations.push({ id, design_id: a[0], slug: a[1], color_scheme: a[2], details: a[3], status: 'pending', event_date: a[4], manage_token_hash: a[5], photos: '[]' });
    return { meta: { last_row_id: id, changes: 1 } };
  }
  if (/^INSERT INTO orders/.test(sql)) {
    const id = db.orders.length + 1;
    db.orders.push({ id, product_id: a[0], customer_email: a[1], amount_centavos: a[2], status: 'pending', terms_accepted_at: a[3], paymongo_checkout_id: null, paymongo_payment_id: null, paid_at: null });
    return { meta: { last_row_id: id, changes: 1 } };
  }
  if (/^UPDATE invitations SET photos = \? WHERE id = \?/.test(sql)) { row('invitations', a[1]).photos = a[0]; return { meta: { changes: 1 } }; }
  if (/^UPDATE orders SET paymongo_checkout_id = \? WHERE id = \?/.test(sql)) { row('orders', a[1]).paymongo_checkout_id = a[0]; return { meta: { changes: 1 } }; }
  if ((m = sql.match(/^DELETE FROM (orders|invitations) WHERE id = \?/))) { db[m[1]] = db[m[1]].filter(r => r.id !== a[0]); return { meta: { changes: 1 } }; }
  if (/^SELECT status FROM orders WHERE id = \?/.test(sql)) return db.orders.find(o => String(o.id) === String(a[0])) ?? null;
  if (/^INSERT OR IGNORE INTO payment_events/.test(sql)) {
    if (db.events.some(e => e.paymongo_event_id === a[0])) return { meta: { changes: 0 } };
    db.events.push({ paymongo_event_id: a[0], type: a[1], payload: a[2], order_id: null });
    return { meta: { changes: 1 } };
  }
  if (/^DELETE FROM payment_events/.test(sql)) { db.events = db.events.filter(e => e.paymongo_event_id !== a[0]); return { meta: { changes: 1 } }; }
  if (/^UPDATE payment_events SET order_id = \?/.test(sql)) { db.events.find(e => e.paymongo_event_id === a[1]).order_id = a[0]; return { meta: { changes: 1 } }; }
  if (/FROM orders o JOIN invitations i .* WHERE o.paymongo_checkout_id = \?/.test(sql)) {
    const o = db.orders.find(x => x.paymongo_checkout_id === a[0]);
    if (!o) return null;
    const i = row('invitations', o.product_id);
    return { ...o, invitation_id: i.id, slug: i.slug, design_name: db.designs.find(d => d.id === i.design_id).name };
  }
  if (/^UPDATE orders SET status = 'paid'/.test(sql)) {
    const o = row('orders', a[2]);
    if (!o || o.status !== 'pending') return { meta: { changes: 0 } };
    Object.assign(o, { status: 'paid', paid_at: a[0], paymongo_payment_id: a[1] });
    return { meta: { changes: 1 } };
  }
  if (/^UPDATE invitations SET status = 'live', manage_token_hash = \? WHERE id = \? AND status = 'pending'/.test(sql)) {
    const i = row('invitations', a[1]);
    if (!i || i.status !== 'pending') return { meta: { changes: 0 } };
    Object.assign(i, { status: 'live', manage_token_hash: a[0] });
    return { meta: { changes: 1 } };
  }
  if (/smtp_settings/.test(sql)) return { enabled: 1, host: 'h', port: 587, senderName: 'JLC', senderEmail: 'co@x.com' };
  if (/FROM (branding|content)/.test(sql)) return null;
  throw new Error('Unexpected SQL: ' + sql);
}
const stmt = (sql) => {
  const q = { args: [], bind(...a) { q.args = a; return q; },
    async first() { return exec(sql, q.args); }, async all() { return exec(sql, q.args); }, async run() { return exec(sql, q.args); } };
  return q;
};
const DB = { prepare: stmt, async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; } };

// --- Fake R2 ---
const r2 = new Map();
const PHOTOS = {
  async put(key, value, opts) { r2.set(key, { value, opts }); },
  async get(key) { return r2.get(key) ?? null; },
  async delete(keys) { for (const k of [].concat(keys)) r2.delete(k); },
};

// --- Stubbed fetch: Turnstile accepts only 'good-token'; PayMongo records calls ---
const paymongoCalls = [];
let paymongoFails = false;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) {
    const form = new URLSearchParams(init.body);
    return Response.json({ success: form.get('secret') === 'turnstile-secret' && form.get('response') === 'good-token' });
  }
  if (String(url).startsWith('https://api.paymongo.com/v1/checkout_sessions')) {
    paymongoCalls.push(JSON.parse(init.body));
    if (paymongoFails) return Response.json({ errors: [{ detail: 'bad request' }] }, { status: 400 });
    return Response.json({ data: { id: 'cs_' + paymongoCalls.length, attributes: { checkout_url: 'https://checkout.paymongo.com/cs_' + paymongoCalls.length } } });
  }
  throw new Error('Unexpected fetch ' + url);
};

const WEBHOOK_SECRET = 'whsk_test';
const background = [];
const settle = () => Promise.all(background.splice(0));
const env = () => ({ DB, PHOTOS, TURNSTILE_SECRET_KEY: 'turnstile-secret', PAYMONGO_SECRET_KEY: 'sk_test_x', PAYMONGO_WEBHOOK_SECRET: WEBHOOK_SECRET });
const ctx = (request) => ({ request, env: env(), waitUntil(p) { background.push(p); } });
const get = (path) => invitations(ctx(new Request('https://shop.test' + path)));
const post = (path, body) => invitations(ctx(new Request('https://shop.test' + path, { method: 'POST', body: JSON.stringify(body) })));

const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
const goodCheckout = (extra = {}) => ({
  designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'Bride@Example.com', termsAccepted: true, turnstileToken: 'good-token',
  details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } },
  photos: [PNG], ...extra,
});

test('designs lists active designs with public fields only', async () => {
  const res = await get('/api/invitations/designs');
  assert.equal(res.status, 200);
  const { designs } = await res.json();
  assert.equal(designs.length, 1);
  assert.deepEqual(Object.keys(designs[0]).sort(), ['colorSchemes', 'layoutKey', 'name', 'previewImages', 'priceCentavos', 'sampleDetails', 'slug']);
  assert.equal(designs[0].colorSchemes[0].name, 'Blush');
});

test('checkout without termsAccepted → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ termsAccepted: undefined }));
  assert.equal(res.status, 400);
  assert.equal(db.orders.length, 0);
});

test('checkout with a bad Turnstile token → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ turnstileToken: 'bad' }));
  assert.equal(res.status, 400);
  assert.equal(paymongoCalls.length, 0);
});

test('checkout ignores amount in the body and charges the DB price', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ amount: 1, amountCentavos: 1 }));
  assert.equal(res.status, 200);
  assert.equal(paymongoCalls[0].data.attributes.line_items[0].amount, 99900);
  assert.equal(db.orders[0].amount_centavos, 99900);
});

test('checkout with 7 photos → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ photos: Array(7).fill(PNG) }));
  assert.equal(res.status, 400);
  assert.equal(r2.size, 0);
});

test('checkout rejects non-image data URLs and unknown color schemes', async () => {
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ photos: ['data:text/html;base64,PGI+'] }))).status, 400);
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ colorScheme: 'Neon' }))).status, 400);
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ designSlug: 'hidden' }))).status, 400);
  assert.equal(db.invitations.length, 0);
});

test('successful checkout creates pending rows and returns checkoutUrl', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { checkoutUrl: 'https://checkout.paymongo.com/cs_1' });
  const [inv] = db.invitations, [order] = db.orders;
  assert.equal(inv.status, 'pending');
  assert.match(inv.slug, /^maria-and-juan-[a-z0-9]+$/);
  assert.deepEqual(JSON.parse(inv.color_scheme), JSON.parse(design.color_schemes)[0]);
  assert.match(inv.manage_token_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(JSON.parse(inv.photos), ['inv/1/0.png']);
  assert.equal(r2.get('inv/1/0.png').opts.httpMetadata.contentType, 'image/png');
  assert.equal(Buffer.from(r2.get('inv/1/0.png').value).toString(), 'fake-png');
  assert.equal(order.status, 'pending');
  assert.equal(order.customer_email, 'bride@example.com');
  assert.equal(order.paymongo_checkout_id, 'cs_1');
  assert.ok(order.terms_accepted_at);
  const a = paymongoCalls[0].data.attributes;
  assert.equal(a.reference_number, '1');
  assert.deepEqual(a.metadata, { order_id: '1' });
  assert.equal(a.cancel_url, 'https://shop.test/invitations/classic-elegance');
  const m = a.success_url.match(/^https:\/\/shop\.test\/invitations\/success#1\.([A-Za-z0-9_-]{43})$/);
  assert.ok(m, a.success_url);
  const { createHash } = await import('node:crypto');
  assert.equal(createHash('sha256').update(m[1]).digest('hex'), inv.manage_token_hash);
});

test('PayMongo 400 → 502 and the rows and R2 objects are gone', async () => {
  paymongoFails = true;
  const res = await post('/api/invitations/checkout', goodCheckout());
  assert.equal(res.status, 502);
  assert.ok((await res.json()).error);
  assert.equal(db.invitations.length, 0);
  assert.equal(db.orders.length, 0);
  assert.equal(r2.size, 0);
});

test('order-status for a pending order → { status: "pending" }', async () => {
  await post('/api/invitations/checkout', goodCheckout());
  const res = await get('/api/invitations/order-status?order=1');
  assert.deepEqual(await res.json(), { status: 'pending' });
  assert.equal((await get('/api/invitations/order-status?order=999')).status, 404);
});

// --- Webhook ---
const paidEvent = (id = 'evt_1', checkoutId = 'cs_1') => JSON.stringify({ data: { id, type: 'event', attributes: {
  type: 'checkout_session.payment.paid', livemode: false,
  data: { id: checkoutId, type: 'checkout_session', attributes: { payments: [{ id: 'pay_1' }] } } } } });
const sign = (body, t = Math.floor(Date.now() / 1000)) => `t=${t},te=${createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')},li=`;
const hook = (body, sig = sign(body)) => webhook(ctx(new Request('https://shop.test/api/paymongo/webhook',
  { method: 'POST', body, headers: { 'Paymongo-Signature': sig } })));
const emails = () => globalThis.SMTP_SENT.filter(t => t.startsWith('Message-ID'));
const checkedOut = async () => { await post('/api/invitations/checkout', goodCheckout()); return db.invitations[0].manage_token_hash; };

test('webhook with a bad signature → 401, nothing changes', async () => {
  await checkedOut();
  const body = paidEvent();
  const res = await hook(body, sign(body).replace(/te=./, 'te=0'));
  assert.equal(res.status, 401);
  await settle();
  assert.equal(db.events.length, 0);
  assert.equal(db.orders[0].status, 'pending');
  assert.equal(emails().length, 0);
});

test('valid paid webhook → order paid, invitation live, one email with links', async () => {
  const oldHash = await checkedOut();
  const res = await hook(paidEvent());
  assert.equal(res.status, 200);
  await settle();
  assert.equal(db.orders[0].status, 'paid');
  assert.equal(db.orders[0].paymongo_payment_id, 'pay_1');
  assert.ok(db.orders[0].paid_at);
  assert.equal(db.invitations[0].status, 'live');
  assert.notEqual(db.invitations[0].manage_token_hash, oldHash);
  assert.equal(db.events[0].order_id, 1);
  assert.equal(emails().length, 1);
  const mail = emails()[0].replace(/=\r\n/g, '');
  assert.ok(mail.includes(`https://shop.test/i/${db.invitations[0].slug}`), 'public link');
  assert.ok(/https:\/\/shop\.test\/manage#[A-Za-z0-9_-]{43}/.test(mail), 'manage link');
  assert.ok(mail.includes('999.00') && mail.includes('Classic Elegance'), 'receipt');
});

test('same event again → 200, still one email', async () => {
  await checkedOut();
  const body = paidEvent();
  assert.equal((await hook(body)).status, 200);
  await settle();
  const hash = db.invitations[0].manage_token_hash;
  assert.equal((await hook(body)).status, 200);
  await settle();
  assert.equal(emails().length, 1);
  assert.equal(db.invitations[0].manage_token_hash, hash);
});

test('paid event for a refunded order → stays refunded, no email', async () => {
  await checkedOut();
  db.orders[0].status = 'refunded';
  db.invitations[0].status = 'refunded';
  assert.equal((await hook(paidEvent())).status, 200);
  await settle();
  assert.equal(db.orders[0].status, 'refunded');
  assert.equal(db.invitations[0].status, 'refunded');
  assert.equal(emails().length, 0);
  assert.equal(db.events.length, 1);
});

test('other event types are stored and return 200', async () => {
  const body = JSON.stringify({ data: { id: 'evt_x', attributes: { type: 'payment.failed', livemode: false, data: {} } } });
  assert.equal((await hook(body)).status, 200);
  assert.equal(db.events[0].type, 'payment.failed');
});
