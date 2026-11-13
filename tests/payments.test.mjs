// Payment providers and the PayMongo webhook on the real-SQL harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const P = await bundle('server/payments/index.ts');
const { onRequestPost: webhook } = await bundle('functions/api/payments/paymongo/webhook.ts');
const SECRET = 'whsk_test';

const full = { provider: 'manual_gcash', gcashAccountName: 'Ana', gcashNumber: '0917', instructions: '', qrKey: 'qr/1.png', deadlineHours: 48 };

test('activeProvider: manual GCash unless provider is paymongo', () => {
  assert.equal(P.activeProvider(full).key, 'manual_gcash');
  assert.equal(P.activeProvider({ ...full, provider: 'whatever' }).key, 'manual_gcash');
  assert.equal(P.activeProvider({ ...full, provider: 'paymongo' }).key, 'paymongo');
});

test('manual GCash is ready only when name, number and QR are all set', () => {
  const p = P.activeProvider(full);
  assert.equal(p.ready(full), null);
  for (const k of ['gcashAccountName', 'gcashNumber', 'qrKey']) {
    assert.equal(p.ready({ ...full, [k]: k === 'qrKey' ? null : '' }), 'GCash payment details are not set up yet.');
  }
});

test('loadPaymentSettings reads the default row; paymentInstructions shapes it', async () => {
  const db = makeD1();
  db.exec.exec("UPDATE payment_settings SET gcash_account_name = 'Ana', gcash_number = '0917', qr_key = 'qr/1.png'");
  const s = await P.loadPaymentSettings(db);
  assert.deepEqual(s, { ...full, provider: 'manual_gcash' });
  const i = P.paymentInstructions(s, { reference: 'JLC-ABCDEF', amountCentavos: 1500, paymentDeadline: '2026-11-15T00:00:00.000Z' });
  assert.equal(i.qrUrl, '/api/orders/gcash-qr');
  assert.equal(i.deadline, '2026-11-15T00:00:00.000Z');
  assert.equal(i.accountNumber, '0917');
});

function seed(status = 'pending_payment') {
  const db = makeD1();
  db.exec.exec(`
    INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (1, 'rose', 'Rose', 'classic', 150000);
    INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
      VALUES (1, 1, 'ana-ben', 'blush', '{}', '[]', 'pending', '2027-01-01', 'h0');
    INSERT INTO orders (id, product_id, customer_email, amount_centavos, status, reference, provider, paymongo_checkout_id)
      VALUES (1, 1, 'ana@x.com', 150000, '${status}', 'JLC-ABCDEF', 'paymongo', 'cs_1');`);
  return db;
}
const paid = (id = 'evt_1') => JSON.stringify({ data: { id, type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false,
  data: { id: 'cs_1', type: 'checkout_session', attributes: { payments: [{ id: 'pay_1' }] } } } } });
const sign = (body, t = Math.floor(Date.now() / 1000)) => `t=${t},te=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')},li=`;
const hook = (db, body, sig = sign(body)) => webhook({ env: { DB: db, PAYMONGO_WEBHOOK_SECRET: SECRET }, waitUntil() {},
  request: new Request('https://shop.test/api/payments/paymongo/webhook', { method: 'POST', body, headers: { 'Paymongo-Signature': sig } }) });
const q = (db, sql) => db.exec.prepare(sql).all();

test('webhook: bad signature → 401, nothing changes', async () => {
  const db = seed();
  assert.equal((await hook(db, paid(), 't=1,te=00,li=')).status, 401);
  assert.equal(q(db, 'SELECT * FROM payment_events').length, 0);
  assert.equal(q(db, 'SELECT status FROM orders')[0].status, 'pending_payment');
});

test('webhook: paid event → payment confirmed, order for_review; repeat changes nothing', async () => {
  const db = seed();
  const body = paid();
  assert.equal((await hook(db, body)).status, 200);
  assert.equal(q(db, 'SELECT status FROM orders')[0].status, 'for_review');
  const pays = q(db, 'SELECT * FROM payments');
  assert.equal(pays.length, 1);
  assert.deepEqual([pays[0].provider, pays[0].status, pays[0].customer_reference, pays[0].amount_centavos, pays[0].verified_by], ['paymongo', 'confirmed', 'pay_1', 150000, 'paymongo']);
  assert.equal((await hook(db, body)).status, 200);
  assert.equal(q(db, 'SELECT * FROM payments').length, 1);
  assert.equal(q(db, 'SELECT status FROM orders')[0].status, 'for_review');
});

for (const status of ['cancelled', 'refunded']) {
  test(`webhook: payment for a ${status} order → 200, one audit row, order untouched`, async () => {
    const db = seed(status);
    const body = paid();
    const err = console.error; console.error = () => {};
    try { assert.equal((await hook(db, body)).status, 200); assert.equal((await hook(db, body)).status, 200); } finally { console.error = err; }
    assert.equal(q(db, 'SELECT status FROM orders')[0].status, status);
    assert.equal(q(db, 'SELECT * FROM payments').length, 0);
    const audit = q(db, 'SELECT * FROM audit_logs');
    assert.equal(audit.length, 1);
    assert.match(audit[0].message, new RegExp(`${status} order JLC-ABCDEF.*refund`, 'i'));
  });
}

test('webhook: other event types are stored and return 200', async () => {
  const db = seed();
  const body = JSON.stringify({ data: { id: 'evt_x', attributes: { type: 'payment.failed', livemode: false, data: {} } } });
  assert.equal((await hook(db, body)).status, 200);
  assert.equal(q(db, 'SELECT type FROM payment_events')[0].type, 'payment.failed');
});
