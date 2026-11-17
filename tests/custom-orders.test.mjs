// Phase 4b: custom-package checkout, payment routing to In Production, deliver rules, customer copy.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: orders } = await bundle('functions/api/orders/[[path]].ts');
const { onRequest: adminOrders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { onRequestPost: webhook } = await bundle('functions/api/payments/paymongo/webhook.ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const { can } = await bundle('server/permissions.ts');
const { CUSTOMER_MESSAGE_CUSTOM } = await bundle('shared/order-status.ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: new URLSearchParams(init.body).get('response') === 'good-token' });
  throw new Error('Unexpected fetch ' + url);
};

const SECRET = 'jwt-secret';
const NOTES_ERR = "Please tell the designer what you'd like (up to 1,500 characters).";
let db, r2;
const pkg = (key, name, priceCentavos, kind = 'template') => ({ key, name, priceCentavos, inclusions: [], kind });
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  db.exec.prepare(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type, packages)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation', ?)`)
    .run(JSON.stringify([pkg('standard', 'Standard', 99900), pkg('bespoke', 'Bespoke', 500000, 'custom')]));
  db.exec.exec("UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '09171234567', qr_key = 'settings/qr.png'");
  db.exec.exec("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES ('boss@jlc.test', 'boss', 'Super Admin', 'Active', 1, 't')");
});
const env = () => ({ DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'x', JWT_SECRET: SECRET, PAYMONGO_WEBHOOK_SECRET: 'whsk' });
const ctx = (request) => ({ request, env: env(), waitUntil() {} });
const q = (sql) => db.exec.prepare(sql).all();
const checkout = (extra = {}) => invitations(ctx(new Request('https://shop.test/api/invitations/checkout', { method: 'POST', body: JSON.stringify({
  designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'bride@example.com', name: 'Maria Cruz', termsAccepted: true, turnstileToken: 'good-token',
  details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } }, ...extra,
}) })));
const placed = async (extra) => {
  const res = await checkout(extra);
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  return { ...body, id: q(`SELECT id FROM orders WHERE reference = '${body.reference}'`)[0].id };
};
const admin = async (path, body) => adminOrders({ env: env(), waitUntil() {}, request: new Request('https://shop.test/api/admin/orders' + path, {
  method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { Authorization: 'Bearer ' + await signAdminToken('boss@jlc.test', SECRET) } }) });
const view = async (o) => (await orders(ctx(new Request(`https://shop.test/api/orders/${o.reference}`, { headers: { 'X-Order-Token': o.trackingToken } })))).json();
// Puts an order in payment_verification with a submitted payment, then approves it as an admin
const approve = async (o) => {
  db.exec.exec(`UPDATE orders SET status = 'payment_verification' WHERE id = ${o.id}`);
  const pid = db.exec.prepare(`INSERT INTO payments (order_id, provider, amount_centavos, status, submitted_at) VALUES (${o.id}, 'manual_gcash', 1, 'submitted', 't')`).run().lastInsertRowid;
  const res = await admin(`/${o.id}`, { action: 'approve', paymentId: Number(pid) });
  assert.equal(res.status, 200, await res.clone().text());
};
const status = (o) => q(`SELECT status FROM orders WHERE id = ${o.id}`)[0].status;

test('custom checkout without notes, blank notes or notes over 1,500 → 400, nothing created', async () => {
  for (const designerNotes of [undefined, '', '   ', 42, 'x'.repeat(1501)]) {
    const res = await checkout({ packageKey: 'bespoke', designerNotes });
    assert.equal(res.status, 400, String(designerNotes));
    assert.deepEqual(await res.json(), { error: NOTES_ERR });
  }
  assert.equal(q('SELECT * FROM orders').length, 0);
});

test('custom checkout with notes → custom order at the stored custom price, notes trimmed', async () => {
  await placed({ packageKey: 'bespoke', designerNotes: `  ${'n'.repeat(1500)}  `, amountCentavos: 1 });
  const [o] = q('SELECT package_kind, designer_notes, amount_centavos, package_key FROM orders');
  assert.deepEqual({ ...o }, { package_kind: 'custom', designer_notes: 'n'.repeat(1500), amount_centavos: 500000, package_key: 'bespoke' });
});

test('template checkout ignores designerNotes (stored NULL, kind template)', async () => {
  await placed({ designerNotes: 'please make it pink' });
  assert.deepEqual({ ...q('SELECT package_kind, designer_notes FROM orders')[0] }, { package_kind: 'template', designer_notes: null });
});

test('approving payment: custom → in_production (actor system), template → for_review', async () => {
  const c = await placed({ packageKey: 'bespoke', designerNotes: 'Gold foil' });
  const t = await placed();
  await approve(c);
  await approve(t);
  assert.equal(status(c), 'in_production');
  assert.equal(status(t), 'for_review');
  assert.equal(q(`SELECT actor FROM order_events WHERE order_id = ${c.id} AND to_status = 'in_production'`)[0].actor, 'system');
});

test('PayMongo webhook retry on a confirmed custom order → in_production', async () => {
  const c = await placed({ packageKey: 'bespoke', designerNotes: 'Gold foil' });
  db.exec.exec(`UPDATE orders SET status = 'payment_confirmed', paymongo_checkout_id = 'cs_1' WHERE id = ${c.id}`);
  const body = JSON.stringify({ data: { id: 'evt_1', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: 'cs_1' } } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = `t=${t},te=${createHmac('sha256', 'whsk').update(`${t}.${body}`).digest('hex')},li=`;
  const res = await webhook({ env: env(), waitUntil() {}, request: new Request('https://shop.test/api/payments/paymongo/webhook', { method: 'POST', body, headers: { 'Paymongo-Signature': sig } }) });
  assert.equal(res.status, 200);
  assert.equal(status(c), 'in_production');
});

test('deliver: custom from for_review → 409, from completed → ok; template from for_review still ok', async () => {
  const c = await placed({ packageKey: 'bespoke', designerNotes: 'Gold foil' });
  db.exec.exec(`UPDATE orders SET status = 'for_review' WHERE id = ${c.id}`);
  assert.equal((await admin(`/${c.id}`, { action: 'deliver' })).status, 409);
  assert.equal(status(c), 'for_review');
  db.exec.exec(`UPDATE orders SET status = 'completed' WHERE id = ${c.id}`);
  assert.equal((await admin(`/${c.id}`, { action: 'deliver' })).status, 200);
  assert.equal(status(c), 'delivered');
  const t = await placed();
  db.exec.exec(`UPDATE orders SET status = 'for_review' WHERE id = ${t.id}`);
  assert.equal((await admin(`/${t.id}`, { action: 'deliver' })).status, 200);
});

test('customer GET: custom orders get the custom messages and packageKind; templates keep the old copy', async () => {
  const c = await placed({ packageKey: 'bespoke', designerNotes: 'Gold foil' });
  const t = await placed();
  for (const s of ['in_production', 'for_review', 'revision_requested', 'completed']) {
    db.exec.exec(`UPDATE orders SET status = '${s}'`);
    const cv = await view(c);
    assert.equal(cv.message, CUSTOMER_MESSAGE_CUSTOM[s]);
    assert.equal(cv.packageKind, 'custom');
    assert.notEqual((await view(t)).message, CUSTOMER_MESSAGE_CUSTOM[s]);
  }
  assert.equal(CUSTOMER_MESSAGE_CUSTOM.for_review, 'Your proof is ready — please review it below.');
  db.exec.exec("UPDATE orders SET status = 'pending_payment'");
  assert.match((await view(c)).message, /payment QR code/); // falls back for other statuses
  assert.equal((await view(t)).packageKind, 'template');
});

test('admin list and detail return packageKind', async () => {
  const c = await placed({ packageKey: 'bespoke', designerNotes: 'Gold foil' });
  assert.equal((await (await admin(`/${c.id}`)).json()).order.packageKind, 'custom');
  assert.equal((await (await admin('')).json()).orders[0].packageKind, 'custom');
});

test('inquiries.manage and customers.view: Super Admin and Administrator only', () => {
  for (const a of ['inquiries.manage', 'customers.view']) {
    assert.equal(can('Super Admin', a), true);
    assert.equal(can('Administrator', a), true);
    assert.equal(can('Editor', a), false);
  }
});
