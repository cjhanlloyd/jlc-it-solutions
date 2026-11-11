// Tests for the invitation checkout API and the PayMongo webhook. Run: npm test
// Both handlers are bundled with esbuild; D1, R2, SMTP, Turnstile and PayMongo are in-memory fakes.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
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
  webhook = (await bundle('functions/api/payments/paymongo/webhook.ts', 'hook.mjs')).onRequestPost;
});

// --- In-memory D1: answers only the statements the two handlers issue ---
const design = { id: 1, slug: 'classic-elegance', name: 'Classic Elegance', layout_key: 'classic', price_centavos: 99900,
  color_schemes: JSON.stringify([{ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' }]),
  preview_images: '[]', sample_details: '{}', active: 1, sort_order: 0, product_type: 'wedding_invitation' };
const birthdayDesign = { ...design, id: 3, slug: 'confetti-pop', name: 'Confetti Pop', layout_key: 'confetti', product_type: 'birthday_invitation' };
let db, smtpEnabled = true;
beforeEach(() => {
  db = { designs: [design, { ...design, id: 2, slug: 'hidden', active: 0 }, birthdayDesign, { ...design, id: 4, slug: 'baptism', product_type: 'baptism_invitation' }], invitations: [], orders: [], events: [], rsvps: [], audit: [] };
  globalThis.SMTP_SENT = [];
  globalThis.SMTP_FAIL = false;
  smtpEnabled = true;
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
  if (/FROM orders o LEFT JOIN invitations i .* WHERE o.paymongo_checkout_id = \?/.test(sql)) {
    const o = db.orders.find(x => x.paymongo_checkout_id === a[0]);
    if (!o) return null;
    const i = row('invitations', o.product_id);
    return { ...o, invitation_id: o.product_id, slug: i?.slug ?? null, design_name: i ? db.designs.find(d => d.id === i.design_id).name : null };
  }
  if (/^UPDATE orders SET status = 'paid'/.test(sql)) {
    const o = row('orders', a[2]);
    if (!o || o.status !== 'pending') return { meta: { changes: 0 } };
    Object.assign(o, { status: 'paid', paid_at: a[0], paymongo_payment_id: a[1] });
    return { meta: { changes: 1 } };
  }
  // --- Task 5: manage, RSVP, resend ---
  if (/FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.manage_token_hash = \? AND i.status = 'live'/.test(sql)) {
    const i = db.invitations.find(x => x.manage_token_hash === a[0] && x.status === 'live');
    if (!i) return null;
    const d = db.designs.find(x => x.id === i.design_id);
    return { ...i, design_slug: d.slug, design_name: d.name, layout_key: d.layout_key, product_type: d.product_type };
  }
  if (/^UPDATE invitations SET details = \?, event_date = \?, photos = \? WHERE id = \?/.test(sql)) {
    Object.assign(row('invitations', a[3]), { details: a[0], event_date: a[1], photos: a[2] });
    return { meta: { changes: 1 } };
  }
  if (/^UPDATE invitations SET manage_token_hash = \? WHERE id = \? AND status = 'live'/.test(sql)) {
    const i = row('invitations', a[1]);
    if (!i || i.status !== 'live') return { meta: { changes: 0 } };
    i.manage_token_hash = a[0];
    return { meta: { changes: 1 } };
  }
  // Batch statements run in order, so the EXISTS sees the order UPDATE that just ran
  if (/^UPDATE invitations SET status = 'live' WHERE id = \? AND status = 'pending' AND EXISTS \(SELECT 1 FROM orders WHERE id = \? AND status = 'paid'\)$/.test(sql)) {
    const i = row('invitations', a[0]);
    if (!i || i.status !== 'pending' || row('orders', a[1])?.status !== 'paid') return { meta: { changes: 0 } };
    i.status = 'live';
    return { meta: { changes: 1 } };
  }
  if (/^SELECT i\.id, i\.details, d\.product_type FROM invitations i JOIN products_designs d ON d\.id = i\.design_id WHERE i\.slug = \? AND i\.status = 'live'/.test(sql)) {
    const i = db.invitations.find(x => x.slug === a[0] && x.status === 'live');
    return i ? { ...i, product_type: db.designs.find(d => d.id === i.design_id).product_type } : null;
  }
  if (/^SELECT i\.\*, d\.layout_key, d\.product_type FROM invitations i JOIN products_designs d ON d\.id = i\.design_id WHERE i\.slug = \?/.test(sql)) {
    const i = db.invitations.find(x => x.slug === a[0]);
    const d = i && db.designs.find(x => x.id === i.design_id);
    return i ? { ...i, layout_key: d.layout_key, product_type: d.product_type } : null;
  }
  if (/^INSERT INTO rsvps .* WHERE \(SELECT COUNT\(\*\) FROM rsvps WHERE invitation_id = \?\) < 300/.test(sql)) {
    if (db.rsvps.filter(r => r.invitation_id === a[0]).length >= 300) return { meta: { changes: 0 } };
    db.rsvps.push({ id: db.rsvps.length + 1, invitation_id: a[0], guest_name: a[1], attending: a[2], party_size: a[3], kids_count: a[4], message: a[5], created_at: '2026-11-10 08:00:00' });
    return { meta: { changes: 1 } };
  }
  if (/FROM rsvps WHERE invitation_id = \?/.test(sql)) return { results: db.rsvps.filter(r => r.invitation_id === a[0]) };
  if (/^SELECT COUNT\(\*\) AS count FROM audit_logs WHERE log_type = 'invitation_resend' AND message = \? AND timestamp > \?/.test(sql)) {
    return { count: db.audit.filter(l => l.log_type === 'invitation_resend' && l.message === a[0] && l.timestamp > a[1]).length };
  }
  if (/^INSERT INTO audit_logs \(timestamp, log_type, message\) VALUES \(\?, 'invitation_resend', \?\)/.test(sql)) {
    db.audit.push({ timestamp: a[0], log_type: 'invitation_resend', message: a[1] });
    return { meta: { changes: 1 } };
  }
  if (/FROM orders o JOIN invitations i ON i.id = o.product_id WHERE o.customer_email = \? AND o.status = 'paid' AND i.status = 'live'/.test(sql)) {
    return { results: db.orders.filter(o => o.customer_email === a[0] && o.status === 'paid')
      .map(o => row('invitations', o.product_id)).filter(i => i && i.status === 'live').map(i => ({ id: i.id, slug: i.slug })) };
  }
  if (/^INSERT INTO audit_logs \(timestamp, log_type, message\) VALUES \(\?, 'security', \?\)/.test(sql)) {
    db.audit.push({ timestamp: a[0], log_type: 'security', message: a[1] });
    return { meta: { changes: 1 } };
  }
  if (/smtp_settings/.test(sql)) return { enabled: smtpEnabled ? 1 : 0, host: 'h', port: 587, senderName: 'JLC', senderEmail: 'co@x.com' };
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
  assert.equal(designs.length, 2);
  assert.deepEqual(Object.keys(designs[0]).sort(), ['colorSchemes', 'layoutKey', 'name', 'previewImages', 'priceCentavos', 'productType', 'sampleDetails', 'slug']);
  assert.equal(designs[0].productType, 'wedding_invitation');
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
  const [inv] = db.invitations, [order] = db.orders;
  assert.deepEqual(await res.json(), { checkoutUrl: 'https://checkout.paymongo.com/cs_1', slug: inv.slug });
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
  assert.equal(createHash('sha256').update(m[1]).digest('hex'), inv.manage_token_hash);
});

test('checkout with a past wedding date → 400, nothing created', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ details: { ...goodCheckout().details, eventDate: '2020-01-01' } }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /past/);
  assert.equal(db.invitations.length, 0);
  assert.equal(paymongoCalls.length, 0);
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
const hook = (body, sig = sign(body)) => webhook(ctx(new Request('https://shop.test/api/payments/paymongo/webhook',
  { method: 'POST', body, headers: { 'Paymongo-Signature': sig } })));
const emails = () => globalThis.SMTP_SENT.filter(t => t.startsWith('Message-ID'));
const checkedOut = async () => { await post('/api/invitations/checkout', goodCheckout()); return db.invitations[0].manage_token_hash; };

test('webhook with a bad signature → 401, nothing changes', async () => {
  await checkedOut();
  const body = paidEvent();
  const res = await hook(body, sign(body).replace(/te=(.)/, (_, c) => `te=${c === '0' ? '1' : '0'}`));
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

for (const status of ['expired', 'failed']) {
  test(`paid event for an order in status ${status} → 200, logged for a refund, nothing revived; duplicate ignored`, async () => {
    await checkedOut();
    db.orders[0].status = status;
    if (status === 'expired') db.invitations = []; // cleanup deleted it
    const errors = [];
    const err = console.error; console.error = (...a) => errors.push(a.join(' '));
    try {
      const body = paidEvent();
      assert.equal((await hook(body)).status, 200);
      assert.equal((await hook(body)).status, 200);
      await settle();
    } finally { console.error = err; }
    assert.equal(db.orders[0].status, status);
    assert.ok(db.invitations.every(i => i.status !== 'live'));
    assert.equal(emails().length, 0);
    assert.equal(db.audit.length, 1, 'one audit row; the duplicate is ignored');
    assert.equal(db.audit[0].log_type, 'security');
    assert.match(db.audit[0].message, /order 1\b.*refund/i);
    assert.match(db.audit[0].message, new RegExp(status));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /order 1\b/);
  });
}

test('paid event whose invitation is no longer pending → order paid but no email, token kept', async () => {
  const oldHash = await checkedOut();
  db.invitations[0].status = 'expired';
  const err = console.error; console.error = () => {};
  try {
    assert.equal((await hook(paidEvent())).status, 200);
    await settle();
  } finally { console.error = err; }
  assert.equal(db.orders[0].status, 'paid');
  assert.equal(db.invitations[0].status, 'expired');
  assert.equal(emails().length, 0);
  assert.equal(db.invitations[0].manage_token_hash, oldHash);
});

test('retry after an isolate died between the event insert and processing → processed, order linked, one email', async () => {
  await checkedOut();
  const body = paidEvent();
  db.events.push({ paymongo_event_id: 'evt_1', type: 'checkout_session.payment.paid', payload: body, order_id: null }); // the dead attempt's row
  assert.equal((await hook(body)).status, 200);
  await settle();
  assert.equal(db.orders[0].status, 'paid');
  assert.equal(db.invitations[0].status, 'live');
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].order_id, 1);
  assert.equal(emails().length, 1);
});

test('cleanup half-done (order expired, invitation still pending) before the paid batch → invitation stays pending, one refund audit row, no email', async () => {
  await checkedOut();
  // Cleanup expired the order but has not deleted the invitation yet (e.g. its R2 delete failed)
  const racyDB = { prepare: DB.prepare, async batch(stmts) { db.orders[0].status = 'expired'; return DB.batch(stmts); } };
  const errors = [];
  const err = console.error; console.error = (...a) => errors.push(a.join(' '));
  try {
    const body = paidEvent();
    const res = await webhook({ request: new Request('https://shop.test/api/payments/paymongo/webhook', { method: 'POST', body, headers: { 'Paymongo-Signature': sign(body) } }),
      env: { ...env(), DB: racyDB }, waitUntil(p) { background.push(p); } });
    assert.equal(res.status, 200);
    await settle();
  } finally { console.error = err; }
  assert.equal(db.invitations[0].status, 'pending');
  assert.equal(db.orders[0].status, 'expired');
  assert.equal(db.audit.length, 1);
  assert.match(db.audit[0].message, /expired order 1\b.*refund/i);
  assert.equal(emails().length, 0);
});

test('order expired by cleanup between the webhook read and the paid batch → logged for a refund once, nothing revived', async () => {
  await checkedOut();
  // Cleanup runs right before the batch: order expired, invitation deleted
  const racyDB = { prepare: DB.prepare, async batch(stmts) { db.orders[0].status = 'expired'; db.invitations = []; return DB.batch(stmts); } };
  const racyHook = (body) => webhook({ request: new Request('https://shop.test/api/payments/paymongo/webhook', { method: 'POST', body, headers: { 'Paymongo-Signature': sign(body) } }),
    env: { ...env(), DB: racyDB }, waitUntil(p) { background.push(p); } });
  const errors = [];
  const err = console.error; console.error = (...a) => errors.push(a.join(' '));
  try {
    const body = paidEvent();
    assert.equal((await racyHook(body)).status, 200);
    assert.equal((await hook(body)).status, 200); // PayMongo retry: still expired, no second audit row
    await settle();
  } finally { console.error = err; }
  assert.equal(db.orders[0].status, 'expired');
  assert.equal(emails().length, 0);
  assert.equal(db.audit.length, 1);
  assert.match(db.audit[0].message, /expired order 1\b.*refund/i);
  assert.equal(errors.length, 1);
});

test('other event types are stored and return 200', async () => {
  const body = JSON.stringify({ data: { id: 'evt_x', attributes: { type: 'payment.failed', livemode: false, data: {} } } });
  assert.equal((await hook(body)).status, 200);
  assert.equal(db.events[0].type, 'payment.failed');
});

// --- Manage, RSVP, resend ---
const hash = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'manage-token-1';
const call = (method, path, body, token) => invitations(ctx(new Request('https://shop.test' + path, {
  method, body: body === undefined ? undefined : JSON.stringify(body), headers: token === undefined ? {} : { 'X-Manage-Token': token } })));
// A paid, live invitation (id 1, photo inv/1/0.png) whose manage token is TOKEN
const live = async () => {
  await post('/api/invitations/checkout', goodCheckout());
  Object.assign(db.invitations[0], { status: 'live', manage_token_hash: hash(TOKEN) });
  db.orders[0].status = 'paid';
  return db.invitations[0];
};
const editBody = (details = {}, photos = ['inv/1/0.png']) => ({ details: { ...JSON.parse(db.invitations[0].details), ...details }, photos });
const rsvp = (slug, extra = {}) => post(`/api/invitations/i/${slug}/rsvp`, { guestName: 'Ana', attending: true, partySize: 2, message: 'See you!', turnstileToken: 'good-token', ...extra });

test('manage: no token, wrong token and a non-live invitation all get the identical 404', async () => {
  const inv = await live();
  const bodies = [];
  for (const t of [undefined, 'wrong-token', 'unknown']) {
    const res = await call('GET', '/api/invitations/manage', undefined, t);
    assert.equal(res.status, 404);
    bodies.push(await res.text());
  }
  inv.status = 'refunded';
  const res = await call('GET', '/api/invitations/manage', undefined, TOKEN);
  assert.equal(res.status, 404);
  bodies.push(await res.text());
  assert.deepEqual(new Set(bodies), new Set([JSON.stringify({ error: 'Invitation not found.' })]));
});

test('manage with the correct token returns details and RSVPs', async () => {
  const inv = await live();
  db.rsvps.push({ id: 1, invitation_id: 1, guest_name: 'Ana', attending: 1, party_size: 2, message: 'Yay', created_at: '2026-11-10 08:00:00' });
  const res = await call('GET', '/api/invitations/manage', undefined, TOKEN);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.slug, inv.slug);
  assert.equal(data.productType, 'wedding_invitation');
  assert.equal(data.status, 'live');
  assert.equal(data.design.slug, 'classic-elegance');
  assert.equal(data.colorScheme.name, 'Blush');
  assert.equal(data.details.partner2, 'Juan');
  assert.equal(data.title, 'Maria & Juan');
  assert.equal(data.askKids, false);
  assert.deepEqual(data.photos, ['inv/1/0.png']);
  assert.deepEqual(data.rsvps, [{ guestName: 'Ana', attending: true, partySize: 2, message: 'Yay', submitted: '2026-11-10 08:00:00', kidsCount: 0 }]);
});

test('manage: renaming partner2 → 400, nothing stored', async () => {
  const inv = await live();
  const res = await call('POST', '/api/invitations/manage', editBody({ partner2: 'Pedro' }), TOKEN);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Names cannot be changed after payment.');
  assert.equal(JSON.parse(inv.details).partner2, 'Juan');
});

test('manage: a date change → 200 and stored', async () => {
  const inv = await live();
  const res = await call('POST', '/api/invitations/manage', editBody({ eventDate: '2027-07-01' }), TOKEN);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv.details).eventDate, '2027-07-01');
  assert.equal(inv.event_date, '2027-07-01');
  assert.ok(r2.has('inv/1/0.png'));
});

test('manage: changing the date to a past one → 400; an unchanged past date does not block other edits', async () => {
  const inv = await live();
  let res = await call('POST', '/api/invitations/manage', editBody({ eventDate: '2020-01-01' }), TOKEN);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /past/);
  assert.equal(inv.event_date, '2027-06-12');
  inv.details = JSON.stringify({ ...JSON.parse(inv.details), eventDate: '2020-01-01' }); // the wedding already happened
  res = await call('POST', '/api/invitations/manage', editBody({ message: 'Thank you all!' }), TOKEN);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv.details).message, 'Thank you all!');
});

test('manage: photos keep existing keys, add data URLs, delete removed ones, reject foreign keys and design changes', async () => {
  const inv = await live();
  let res = await call('POST', '/api/invitations/manage', editBody({}, [PNG]), TOKEN);
  assert.equal(res.status, 200);
  const keys = JSON.parse(inv.photos);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^inv\/1\/\d+\.png$/);
  assert.notEqual(keys[0], 'inv/1/0.png');
  assert.ok(!r2.has('inv/1/0.png'), 'removed photo deleted');
  assert.ok(r2.has(keys[0]));
  assert.deepEqual((await res.json()).photos, keys);
  for (const bad of [{ photos: ['inv/2/0.png'] }, { photos: Array(7).fill(PNG) }, { photos: ['data:text/html;base64,PGI+'] }, { colorScheme: 'Blush' }, { design: 'garden' }]) {
    res = await call('POST', '/api/invitations/manage', { ...editBody({}, keys), ...bad }, TOKEN);
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.deepEqual(JSON.parse(inv.photos), keys);
  assert.equal(r2.size, 1);
});

test('RSVP: a valid one is stored; refunded → 404; party size 11 → 400; bad Turnstile → 400; past deadline → 400', async () => {
  const inv = await live();
  assert.equal((await rsvp(inv.slug)).status, 200);
  assert.deepEqual(db.rsvps.map(r => [r.invitation_id, r.guest_name, r.attending, r.party_size, r.message]), [[1, 'Ana', 1, 2, 'See you!']]);
  assert.equal((await rsvp(inv.slug, { partySize: 11 })).status, 400);
  assert.equal((await rsvp(inv.slug, { turnstileToken: 'bad' })).status, 400);
  inv.details = JSON.stringify({ ...JSON.parse(inv.details), rsvpDeadline: '2020-01-01' });
  const closed = await rsvp(inv.slug);
  assert.equal(closed.status, 400);
  assert.equal((await closed.json()).error, 'RSVPs are closed.');
  inv.status = 'refunded';
  const res = await rsvp(inv.slug);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Invitation not found.' });
  assert.equal(db.rsvps.length, 1);
});

test('RSVP CSV escapes quotes and formula cells', async () => {
  await live();
  db.rsvps.push({ id: 1, invitation_id: 1, guest_name: '=SUM(A1)', attending: 0, party_size: 1, message: 'He said "hi"', created_at: '2026-11-10 08:00:00' });
  const res = await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/csv/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.equal(lines[0], 'Name,Attending,Party size,Message,Submitted');
  assert.equal(lines[1], `"'=SUM(A1)","No","1","He said ""hi""","2026-11-10 08:00:00"`);
  assert.equal((await call('GET', '/api/invitations/manage/rsvps.csv', undefined, 'wrong')).status, 404);
});

test('resend for an unknown email → 200 and no email', async () => {
  await live();
  const res = await post('/api/invitations/resend', { email: 'nobody@example.com', turnstileToken: 'good-token' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  await settle();
  assert.equal(emails().length, 0);
});

test('resend for a known email → 200, one email, old token stops working, new one works', async () => {
  await live();
  const res = await post('/api/invitations/resend', { email: 'BRIDE@example.com', turnstileToken: 'good-token' });
  assert.deepEqual(await res.json(), { ok: true });
  await settle();
  assert.equal(emails().length, 1);
  const mail = emails()[0].replace(/=\r\n/g, '');
  assert.ok(mail.includes(`https://shop.test/i/${db.invitations[0].slug}`));
  const fresh = mail.match(/https:\/\/shop\.test\/manage#([A-Za-z0-9_-]{43})/)[1];
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 404);
  assert.equal((await call('GET', '/api/invitations/manage', undefined, fresh)).status, 200);
});

test('resend: bad Turnstile → 400; after 3 per hour it still says ok but sends nothing', async () => {
  await live();
  assert.equal((await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'bad' })).status, 400);
  for (let n = 0; n < 4; n++) {
    const res = await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' });
    assert.deepEqual(await res.json(), { ok: true });
  }
  await settle();
  assert.equal(emails().length, 3);
});

test('resend with SMTP disabled → ok, and the old manage token still works', async () => {
  await live();
  smtpEnabled = false;
  assert.deepEqual(await (await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' })).json(), { ok: true });
  await settle();
  assert.equal(emails().length, 0);
  assert.equal(db.invitations[0].manage_token_hash, hash(TOKEN));
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 200);
});

test('resend where the SMTP send throws → ok, and the old manage token still works', async () => {
  await live();
  globalThis.SMTP_FAIL = true;
  assert.deepEqual(await (await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' })).json(), { ok: true });
  await settle();
  assert.equal(db.invitations[0].manage_token_hash, hash(TOKEN));
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 200);
});

test('paid webhook with SMTP disabled → order paid, invitation live, success-page token still works', async () => {
  await checkedOut();
  const successToken = paymongoCalls[0].data.attributes.success_url.split('#1.')[1];
  smtpEnabled = false;
  assert.equal((await hook(paidEvent())).status, 200);
  await settle();
  assert.equal(db.orders[0].status, 'paid');
  assert.equal(db.invitations[0].status, 'live');
  assert.equal(emails().length, 0);
  assert.equal((await call('GET', '/api/invitations/manage', undefined, successToken)).status, 200);
});

// --- Occasions ---
const bdayDetails = { celebrant: 'Mia', age: 7, eventDate: '2027-06-12', venue: { name: 'Fun Hall' } };
const bdayCheckout = (extra = {}) => goodCheckout({ designSlug: 'confetti-pop', details: bdayDetails, ...extra });
const liveBirthday = async () => {
  assert.equal((await post('/api/invitations/checkout', bdayCheckout())).status, 200);
  Object.assign(db.invitations[0], { status: 'live', manage_token_hash: hash(TOKEN) });
  return db.invitations[0];
};

test('designs list hides unknown occasions', async () => {
  const { designs } = await (await get('/api/invitations/designs')).json();
  assert.deepEqual(designs.map(d => d.slug), ['classic-elegance', 'confetti-pop']);
});

test('birthday checkout stores birthday details and slug', async () => {
  const res = await post('/api/invitations/checkout', bdayCheckout());
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(db.invitations[0].details).celebrant, 'Mia');
  assert.match(db.invitations[0].slug, /^mia-7th-birthday-[a-z0-9]+$/);
  assert.match(paymongoCalls[0].data.attributes.line_items[0].name, /^Birthday invitation:/);
});

test('birthday checkout with wedding details → 400; unknown-occasion design → 400; birthday past date wording', async () => {
  let res = await post('/api/invitations/checkout', bdayCheckout({ details: goodCheckout().details }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Celebrant/);
  res = await post('/api/invitations/checkout', goodCheckout({ designSlug: 'baptism' }));
  assert.equal(res.status, 400);
  res = await post('/api/invitations/checkout', bdayCheckout({ details: { ...bdayDetails, eventDate: '2020-01-01' } }));
  assert.equal((await res.json()).error, 'The party date cannot be in the past.');
  assert.equal(db.invitations.length, 0);
});

test('birthday manage: renaming the celebrant → 400 with the birthday message; manage JSON has productType', async () => {
  await liveBirthday();
  const res = await call('POST', '/api/invitations/manage', editBody({ celebrant: 'Zoe' }), TOKEN);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "The celebrant's name cannot be changed after payment.");
  const m = await (await call('GET', '/api/invitations/manage', undefined, TOKEN)).json();
  assert.equal(m.productType, 'birthday_invitation');
  assert.equal(m.askKids, true);
  assert.match(m.title, /'s .*Birthday$/);
});

test('birthday RSVP stores kids; manage JSON and CSV show them', async () => {
  const inv = await liveBirthday();
  assert.equal((await rsvp(inv.slug, { partySize: 2, kidsCount: 3 })).status, 200);
  assert.equal(db.rsvps[0].kids_count, 3);
  assert.equal((await rsvp(inv.slug, { partySize: 2, kidsCount: 99 })).status, 400);
  const data = await (await call('GET', '/api/invitations/manage', undefined, TOKEN)).json();
  assert.equal(data.rsvps[0].kidsCount, 3);
  const lines = (await (await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN)).text()).trim().split('\r\n');
  assert.equal(lines[0], 'Name,Attending,Adults,Kids,Message,Submitted');
  assert.match(lines[1], /^"Ana","Yes","2","3",/);
});

test('wedding RSVP ignores kidsCount and keeps its CSV header', async () => {
  const inv = await live();
  assert.equal((await rsvp(inv.slug, { kidsCount: 3 })).status, 200);
  assert.equal(db.rsvps[0].kids_count, 0);
  const csvText = await (await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN)).text();
  assert.equal(csvText.split('\r\n')[0], 'Name,Attending,Party size,Message,Submitted');
});

test('guest: live adds productType/askKids; expired returns only the title', async () => {
  const w = await live();
  let g = await (await get(`/api/invitations/i/${w.slug}`)).json();
  assert.deepEqual([g.productType, g.askKids], ['wedding_invitation', false]);
  w.status = 'expired';
  w.details = JSON.stringify({ ...JSON.parse(w.details), partner1: 'Ana', partner2: 'Ben' });
  assert.deepEqual(await (await get(`/api/invitations/i/${w.slug}`)).json(), { state: 'expired', title: 'Ana & Ben' });
  db.invitations = [];
  const b = await liveBirthday();
  g = await (await get(`/api/invitations/i/${b.slug}`)).json();
  assert.deepEqual([g.productType, g.askKids], ['birthday_invitation', true]);
  b.status = 'expired';
  assert.deepEqual(await (await get(`/api/invitations/i/${b.slug}`)).json(), { state: 'expired', title: "Mia's 7th Birthday" });
});
