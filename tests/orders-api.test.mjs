// GCash checkout, the public order page API, receipt upload and lookup, on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: orders } = await bundle('functions/api/orders/[[path]].ts');
const { onRequestGet: photos } = await bundle('functions/photos/[[key]].ts');
const { signOrderView } = await bundle('server/order-view.ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) {
    const form = new URLSearchParams(init.body);
    return Response.json({ success: form.get('secret') === 'turnstile-secret' && form.get('response') === 'good-token' });
  }
  throw new Error('Unexpected fetch ' + url);
};

const SECRET = 'jwt-secret';
let db, r2, background;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  background = [];
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation')`);
});
const gcashReady = () => {
  db.exec.exec("UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '09171234567', qr_key = 'settings/qr.png'");
  r2.map.set('settings/qr.png', { body: 'qr', bytes: new Uint8Array([1]), httpMetadata: { contentType: 'image/png' } });
};
const env = () => ({ DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret', JWT_SECRET: SECRET });
const ctx = (request) => ({ request, env: env(), waitUntil(p) { background.push(p); } });
const req = (path, { method = 'GET', body, token } = {}) => new Request('https://shop.test' + path,
  { method, body: body === undefined ? undefined : JSON.stringify(body), headers: token === undefined ? {} : { 'X-Order-Token': token } });
const q = (sql) => db.exec.prepare(sql).all();

const checkoutBody = (extra = {}) => ({
  designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'Bride@Example.com', name: 'Maria Cruz', phone: '0917', termsAccepted: true,
  turnstileToken: 'good-token', details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } }, ...extra,
});
const checkout = async (extra) => invitations(ctx(req('/api/invitations/checkout', { method: 'POST', body: checkoutBody(extra) })));
const placed = async (extra) => {
  const res = await checkout(extra);
  assert.equal(res.status, 200);
  return res.json();
};
const view = (ref, token) => orders(ctx(req(`/api/orders/${ref}`, { token })));
const upload = (ref, token, image, extra = {}) => orders(ctx(req(`/api/orders/${ref}/receipt`, { method: 'POST', token, body: { image, ...extra } })));

const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const dataUrl = (type, buf) => `data:image/${type};base64,${buf.toString('base64')}`;
const NOT_FOUND = JSON.stringify({ error: 'Order not found.' });

test('checkout with GCash not set up → 503 and nothing created', async () => {
  const res = await checkout();
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'Online ordering is paused while we update payment details. Please contact us.' });
  for (const t of ['orders', 'invitations', 'customers', 'order_events']) assert.equal(q(`SELECT * FROM ${t}`).length, 0, t);
});

test('checkout needs a name of up to 80 characters', async () => {
  gcashReady();
  assert.equal((await checkout({ name: '' })).status, 400);
  assert.equal((await checkout({ name: 'x'.repeat(81) })).status, 400);
  assert.equal((await checkout({ phone: '1'.repeat(31) })).status, 400);
  assert.equal(q('SELECT * FROM orders').length, 0);
});

test('checkout with GCash set up → reference + tracking token, pending_payment order, customer, one visible event', async () => {
  gcashReady();
  const { reference, trackingToken, ...rest } = await placed();
  assert.deepEqual(rest, {});
  assert.match(reference, /^JLC-[A-HJ-NP-Z2-9]{6}$/);
  const [o] = q('SELECT * FROM orders');
  assert.equal(o.reference, reference);
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.provider, 'manual_gcash');
  assert.equal(o.amount_centavos, 99900);
  assert.equal(o.customer_email, 'bride@example.com');
  assert.equal(o.tracking_token_hash, createHash('sha256').update(trackingToken).digest('hex'));
  const created = Date.parse(o.created_at.replace(' ', 'T') + 'Z');
  assert.ok(Math.abs(Date.parse(o.payment_deadline) - created - 48 * 3_600_000) < 5000, o.payment_deadline);
  assert.match(o.payment_deadline, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  const [c] = q('SELECT * FROM customers');
  assert.deepEqual([c.email, c.name, c.phone, o.customer_id], ['bride@example.com', 'Maria Cruz', '0917', c.id]);
  const events = q('SELECT * FROM order_events');
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].visible, events[0].to_status, events[0].note], [1, 'pending_payment', 'Order placed']);
  assert.equal(q('SELECT status FROM invitations')[0].status, 'pending');

  // A second order by the same email updates the customer instead of adding one
  await placed({ email: 'bride@example.com', name: 'Maria C.' });
  assert.deepEqual(q('SELECT name, phone FROM customers').map(r => ({ ...r })), [{ name: 'Maria C.', phone: '0917' }]);
});

test('GET order with the tracking token → payment block; wrong, other or foreign view token → identical 404', async () => {
  gcashReady();
  const a = await placed();
  const b = await placed();
  const res = await view(a.reference, a.trackingToken);
  assert.equal(res.status, 200);
  const o = await res.json();
  assert.equal(o.reference, a.reference);
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.statusLabel, 'Pending Payment');
  assert.equal(o.title, 'Maria & Juan');
  assert.equal(o.designName, 'Classic Elegance');
  assert.equal(o.amountCentavos, 99900);
  assert.equal(o.payment.qrUrl, '/api/orders/gcash-qr');
  assert.equal(o.payment.accountNumber, '09171234567');
  assert.equal(o.lastRejection, null);
  assert.equal(o.guestUrl, undefined);
  assert.equal(o.events.length, 1);
  assert.equal(o.events[0].note, 'Order placed');

  const idB = q(`SELECT id FROM orders WHERE reference = '${b.reference}'`)[0].id;
  const foreignView = await signOrderView(idB, SECRET, new Date());
  const bodies = [];
  for (const [ref, token] of [[a.reference, 'wrong'], [a.reference, b.trackingToken], [a.reference, foreignView], [a.reference, undefined], ['JLC-ZZZZZZ', a.trackingToken]]) {
    const r = await view(ref, token);
    assert.equal(r.status, 404);
    bodies.push(await r.text());
  }
  assert.deepEqual(new Set(bodies), new Set([NOT_FOUND]));
});

test('receipt: PNG → payment_verification + submitted payment under receipts/; second upload → 409', async () => {
  gcashReady();
  const { reference, trackingToken } = await placed();
  const res = await upload(reference, trackingToken, dataUrl('png', PNG_BYTES), { customerReference: '1234 5678' });
  assert.equal(res.status, 200);
  const [o] = q('SELECT id, status FROM orders');
  assert.equal(o.status, 'payment_verification');
  const [p] = q('SELECT * FROM payments');
  assert.deepEqual([p.status, p.amount_centavos, p.provider, p.customer_reference], ['submitted', 99900, 'manual_gcash', '1234 5678']);
  assert.match(p.receipt_key, new RegExp(`^receipts/${o.id}/\\d+-[0-9a-f]{8}\\.png$`));
  assert.deepEqual([...r2.map.keys()].filter(k => k.startsWith('receipts/')), [p.receipt_key]);
  assert.equal(r2.map.get(p.receipt_key).httpMetadata.contentType, 'image/png');
  const again = await upload(reference, trackingToken, dataUrl('png', PNG_BYTES));
  assert.equal(again.status, 409);
  assert.equal(q('SELECT * FROM payments').length, 1);
  assert.equal((await (await view(reference, trackingToken)).json()).payment, null);
});

test('receipt: SVG labelled PNG, mismatched type, or over 5 MB → 400, nothing stored', async () => {
  gcashReady();
  const { reference, trackingToken } = await placed();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  for (const image of [
    dataUrl('png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
    dataUrl('png', jpeg),
    dataUrl('png', Buffer.concat([PNG_BYTES, Buffer.alloc(6_000_000)])),
    'data:image/svg+xml;base64,PHN2Zz4=',
    42,
  ]) assert.equal((await upload(reference, trackingToken, image)).status, 400);
  assert.equal(q('SELECT * FROM payments').length, 0);
  assert.equal(q('SELECT status FROM orders')[0].status, 'pending_payment');
  assert.equal([...r2.map.keys()].filter(k => k.startsWith('receipts/')).length, 0);
  // JPEG and WebP with their real magic bytes are accepted
  assert.equal((await upload(reference, trackingToken, dataUrl('jpeg', jpeg))).status, 200);
});

test('receipt: WebP is accepted', async () => {
  gcashReady();
  const { reference, trackingToken } = await placed();
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
  assert.equal((await upload(reference, trackingToken, dataUrl('webp', webp))).status, 200);
});

test('receipt after the deadline → 409, nothing stored; the next read cancels the order', async () => {
  gcashReady();
  const { reference, trackingToken } = await placed();
  db.exec.exec(`UPDATE orders SET payment_deadline = '${new Date(Date.now() - 1000).toISOString()}'`);
  const res = await upload(reference, trackingToken, dataUrl('png', PNG_BYTES));
  assert.equal(res.status, 409);
  assert.ok((await res.json()).error);
  assert.equal(q('SELECT * FROM payments').length, 0);
  assert.equal([...r2.map.keys()].filter(k => k.startsWith('receipts/')).length, 0);
  const o = await (await view(reference, trackingToken)).json();
  assert.equal(o.status, 'cancelled');
  assert.equal(o.payment, null);
  assert.equal(q('SELECT status FROM orders')[0].status, 'cancelled');
});

test('lookup: right reference + email in any case → view token that opens the order; wrong email → 404', async () => {
  gcashReady();
  const { reference } = await placed();
  const lookup = (body) => orders(ctx(req('/api/orders/lookup', { method: 'POST', body: { turnstileToken: 'good-token', ...body } })));
  assert.equal((await lookup({ reference, email: 'bride@example.com', turnstileToken: 'bad' })).status, 400);
  const res = await lookup({ reference, email: ' BRIDE@example.COM ' });
  assert.equal(res.status, 200);
  const { reference: ref, viewToken } = await res.json();
  assert.equal(ref, reference);
  assert.equal((await view(reference, viewToken)).status, 200);
  for (const body of [{ reference, email: 'groom@example.com' }, { reference: 'JLC-ZZZZZZ', email: 'bride@example.com' }]) {
    const r = await lookup(body);
    assert.equal(r.status, 404);
    assert.equal(await r.text(), NOT_FOUND);
  }
});

test('lookup without JWT_SECRET → 500', async () => {
  const res = await orders({ request: req('/api/orders/lookup', { method: 'POST', body: {} }), env: { ...env(), JWT_SECRET: undefined }, waitUntil() {} });
  assert.equal(res.status, 500);
});

test('view tokens expire after 2 hours', async () => {
  gcashReady();
  const { reference } = await placed();
  const id = q('SELECT id FROM orders')[0].id;
  assert.equal((await view(reference, await signOrderView(id, SECRET, new Date()))).status, 200);
  assert.equal((await view(reference, await signOrderView(id, SECRET, new Date(Date.now() - 2 * 3_600_000 - 1000)))).status, 404);
});

test('gcash-qr streams the QR from R2; 404 when unset', async () => {
  assert.equal((await orders(ctx(req('/api/orders/gcash-qr')))).status, 404);
  gcashReady();
  const res = await orders(ctx(req('/api/orders/gcash-qr')));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(res.headers.get('Content-Type'), 'image/png');
});

test('receipts are never served by the photo route', async () => {
  r2.map.set('receipts/1/x.png', { body: 'x', bytes: new Uint8Array([1]), httpMetadata: {} });
  const res = await photos({ request: new Request('https://shop.test/photos/receipts/1/x.png'), env: env() });
  assert.equal(res.status, 404);
});

test('customer GET: createdAt from SQLite CURRENT_TIMESTAMP comes back as ISO UTC (ends in Z)', async () => {
  gcashReady();
  const a = await placed();
  assert.match(q(`SELECT created_at FROM orders WHERE reference = '${a.reference}'`)[0].created_at, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  const o = await (await view(a.reference, a.trackingToken)).json();
  assert.match(o.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});

test('a malformed percent sequence in the reference is the same 404, not a 500', async () => {
  const res = await orders(ctx(req('/api/orders/JLC-%E0%A4%A', { token: 'x' })));
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Order not found.' });
});
