// Orders core (server/orders.ts) and customer emails (server/order-emails.ts) on the real-SQL harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const O = await bundle('server/orders.ts');
const E = await bundle('server/order-emails.ts');
const NOW = new Date('2026-11-13T00:00:00Z');

async function seed() {
  const db = makeD1();
  const photos = makeR2();
  await photos.put('inv/1/a.jpg', 'x');
  db.exec.exec(`
    INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (1, 'rose', 'Rose', 'classic', 150000);
    INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
      VALUES (1, 1, 'ana-ben', 'blush', '{}', '["inv/1/a.jpg"]', 'pending', '2027-01-01', 'h0');
    INSERT INTO orders (id, product_id, customer_email, amount_centavos, status, reference, payment_deadline, provider)
      VALUES (1, 1, 'ana@x.com', 150000, 'pending_payment', 'JLC-ABCDEF', '2026-11-12T00:00:00.000Z', 'manual_gcash');
    INSERT INTO payments (id, order_id, provider, amount_centavos, status, submitted_at)
      VALUES (1, 1, 'manual_gcash', 150000, 'submitted', '2026-11-11T00:00:00Z');
  `);
  return { db, photos };
}
const one = (db, sql) => db.exec.prepare(sql).get();
const events = (db) => db.exec.prepare('SELECT * FROM order_events ORDER BY id').all();
const toVerification = (db) => O.transition(db, 1, 'payment_verification', { actor: 'ana@x.com' });

test('transition refuses an illegal move and records a legal one', async () => {
  const { db } = await seed();
  const bad = await O.transition(db, 1, 'payment_confirmed', { actor: 'a' });
  assert.equal(bad.ok, false);
  assert.equal(events(db).length, 0);
  assert.deepEqual(await toVerification(db), { ok: true, from: 'pending_payment' });
  const ev = events(db);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, 'status');
  assert.equal(ev[0].from_status, 'pending_payment');
  assert.equal(ev[0].to_status, 'payment_verification');
  assert.equal(ev[0].visible, 1);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'payment_verification');
});

test('transition with a stale from-status writes nothing', async () => {
  const { db } = await seed();
  db.exec.exec("UPDATE orders SET status = 'cancelled'");
  // The read sees the old status; the row changed before the write
  const stale = { batch: (s) => db.batch(s), prepare: (sql) => /^SELECT/.test(sql) ? { bind: () => ({ first: async () => ({ status: 'pending_payment' }) }) } : db.prepare(sql) };
  const r = await O.transition(stale, 1, 'payment_verification', { actor: 'a' });
  assert.deepEqual(r, { ok: false, error: 'The order changed meanwhile. Reload and try again.' });
  assert.equal(events(db).length, 0);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'cancelled');
});

test('confirmPayment twice at once confirms one payment and ends for_review', async () => {
  const { db } = await seed();
  await toVerification(db);
  const rs = await Promise.all([1, 2].map(() => O.confirmPayment(db, 1, { actor: 'admin@x.com', adminReference: 'GC123' })));
  assert.equal(rs.filter((r) => r.ok).length, 1);
  assert.equal(one(db, "SELECT COUNT(*) c FROM payments WHERE status = 'confirmed'").c, 1);
  const p = one(db, 'SELECT * FROM payments');
  assert.equal(p.verified_by, 'admin@x.com');
  assert.equal(p.admin_reference, 'GC123');
  assert.ok(p.verified_at);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'for_review');
  const ev = events(db).slice(1);
  assert.deepEqual(ev.map((e) => [e.to_status, e.actor]), [['payment_confirmed', 'admin@x.com'], ['for_review', 'system']]);
});

test('confirmPayment refuses while the order is not in payment verification', async () => {
  const { db } = await seed();
  const r = await O.confirmPayment(db, 1, { actor: 'a' });
  assert.equal(r.ok, false);
  assert.equal(one(db, 'SELECT status FROM payments').status, 'submitted');
  assert.equal(events(db).length, 0);
});

test('rejectPayment needs a reason, then reopens payment with a visible reason', async () => {
  const { db } = await seed();
  await toVerification(db);
  assert.equal((await O.rejectPayment(db, 1, { actor: 'a', reason: '  ' })).ok, false);
  assert.equal((await O.rejectPayment(db, 1, { actor: 'a', reason: 'x'.repeat(301) })).ok, false);
  assert.equal(one(db, 'SELECT status FROM payments').status, 'submitted');
  const r = await O.rejectPayment(db, 1, { actor: 'a', reason: 'Amount does not match.' });
  assert.equal(r.ok, true);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'pending_payment');
  const p = one(db, 'SELECT * FROM payments');
  assert.equal(p.status, 'rejected');
  assert.equal(p.note, 'Amount does not match.');
  const last = events(db).at(-1);
  assert.equal(last.visible, 1);
  assert.equal(last.note, 'Amount does not match.');
  assert.equal(last.to_status, 'pending_payment');
});

test('deliver from for_review makes the invitation live; from pending_payment it refuses', async () => {
  const { db } = await seed();
  assert.equal((await O.deliver(db, 1, { actor: 'a' })).ok, false);
  assert.equal(one(db, 'SELECT status FROM invitations').status, 'pending');
  assert.equal(one(db, 'SELECT status FROM orders').status, 'pending_payment');
  db.exec.exec("UPDATE orders SET status = 'for_review'");
  assert.equal((await O.deliver(db, 1, { actor: 'a' })).ok, true);
  assert.equal(one(db, 'SELECT status FROM invitations').status, 'live');
  const o = one(db, 'SELECT * FROM orders');
  assert.equal(o.status, 'delivered');
  assert.ok(o.delivered_at);
  assert.equal(events(db).at(-1).to_status, 'delivered');
});

test('deliver changes nothing when the invitation is not pending', async () => {
  const { db } = await seed();
  db.exec.exec("UPDATE orders SET status = 'for_review'; UPDATE invitations SET status = 'expired'");
  assert.equal((await O.deliver(db, 1, { actor: 'a' })).ok, false);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'for_review');
  assert.equal(events(db).length, 0);
});

test('refund marks order and invitation refunded and keeps photos', async () => {
  const { db, photos } = await seed();
  db.exec.exec("UPDATE orders SET status = 'delivered'; UPDATE invitations SET status = 'live'");
  assert.equal((await O.refund(db, photos, 1, { actor: 'a', note: 'Customer asked' })).ok, true);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'refunded');
  assert.equal(one(db, 'SELECT status FROM invitations').status, 'refunded');
  assert.ok(await photos.get('inv/1/a.jpg'));
  assert.equal((await O.refund(db, photos, 1, { actor: 'a', note: 'again' })).ok, false);
});

test('expireIfOverdue cancels an overdue order and purges its pending invitation', async () => {
  const { db, photos } = await seed();
  const order = { id: 1, status: 'pending_payment', payment_deadline: '2026-11-12T00:00:00.000Z', invitation_id: 1 };
  assert.equal(await O.expireIfOverdue(db, photos, { ...order, payment_deadline: '2026-11-14T00:00:00.000Z' }, NOW), false);
  assert.equal(await O.expireIfOverdue(db, photos, order, NOW), true);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'cancelled');
  assert.equal(events(db).at(-1).note, 'Payment deadline passed');
  assert.equal(events(db).at(-1).actor, 'system');
  assert.equal(one(db, 'SELECT COUNT(*) c FROM invitations').c, 0);
  assert.equal(await photos.get('inv/1/a.jpg'), null);
});

test('expireIfOverdue leaves an order in payment verification alone', async () => {
  const { db, photos } = await seed();
  await toVerification(db);
  const order = { id: 1, status: 'payment_verification', payment_deadline: '2026-11-12T00:00:00.000Z', invitation_id: 1 };
  assert.equal(await O.expireIfOverdue(db, photos, order, NOW), false);
  assert.equal(one(db, 'SELECT status FROM orders').status, 'payment_verification');
  assert.equal(one(db, 'SELECT COUNT(*) c FROM invitations').c, 1);
  assert.ok(await photos.get('inv/1/a.jpg'));
});

test('newReference matches the format', () => {
  for (let i = 0; i < 1000; i++) assert.match(O.newReference(), /^JLC-[A-HJ-NP-Z2-9]{6}$/);
});

test('addEvent stores a hidden note by default', async () => {
  const { db } = await seed();
  await O.addEvent(db, 1, { actor: 'a', kind: 'note', note: 'Called the customer' });
  const e = events(db)[0];
  assert.equal(e.kind, 'note');
  assert.equal(e.visible, 0);
});

// --- emails ---
const req = new Request('https://jlc.example/api/x');
const enableSmtp = (db) => db.exec.exec("INSERT INTO smtp_settings (id, host, port, senderName, senderEmail, enabled) VALUES ('default', 'smtp.x', 587, 'JLC', 'no-reply@jlc.example', 1)");
const sent = () => (globalThis.SMTP_SENT ?? []).join('');

test('notify is a no-op when SMTP is disabled and never throws', async () => {
  const { db } = await seed();
  globalThis.SMTP_SENT = [];
  await E.notify(db, req, 1, 'placed', { trackingToken: 't' });
  assert.equal(sent(), '');
  enableSmtp(db);
  globalThis.SMTP_FAIL = true;
  try { await E.notify(db, req, 1, 'confirmed'); } finally { globalThis.SMTP_FAIL = false; }
});

test('placed email carries reference, amount and the tracking link', async () => {
  const { db } = await seed();
  enableSmtp(db);
  globalThis.SMTP_SENT = [];
  await E.notify(db, req, 1, 'placed', { trackingToken: 'tok123' });
  const s = sent();
  assert.match(s, /RCPT TO:<ana@x\.com>/);
  assert.ok(s.includes('JLC-ABCDEF'));
  assert.ok(s.includes('PHP 1,500.00'));
  assert.ok(s.includes('https://jlc.example/order/JLC-ABCDEF#tok123'));
  assert.ok(!/paymongo/i.test(s));
});

test('rejected email reads the reason from the payment', async () => {
  const { db } = await seed();
  enableSmtp(db);
  await toVerification(db);
  await O.rejectPayment(db, 1, { actor: 'a', reason: 'Blurry receipt photo' });
  globalThis.SMTP_SENT = [];
  await E.notify(db, req, 1, 'rejected');
  assert.ok(sent().includes('Blurry receipt photo'));
});

test('delivered email rotates the manage token and carries guest, manage and order links', async () => {
  const { db } = await seed();
  enableSmtp(db);
  db.exec.exec("UPDATE orders SET status = 'for_review'");
  await O.deliver(db, 1, { actor: 'a' });
  globalThis.SMTP_SENT = [];
  await E.notify(db, req, 1, 'delivered');
  const s = sent();
  assert.ok(s.includes('https://jlc.example/i/ana-ben'));
  assert.ok(s.includes('https://jlc.example/manage#'));
  assert.ok(s.includes('https://jlc.example/order/JLC-ABCDEF'));
  assert.notEqual(one(db, 'SELECT manage_token_hash h FROM invitations').h, 'h0');
});
