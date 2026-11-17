// runCleanup: payment-deadline expiry, stuck cancelled orders and the receipt purge, on the real-SQL harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { runCleanup } = await bundle('server/cleanup.ts');
const NOW = new Date('2026-11-13T12:00:00.000Z');
const MIN = 60_000, DAY = 86_400_000;
const iso = (ms) => new Date(NOW.getTime() - ms).toISOString();
const sqlTs = (ms) => iso(ms).replace('T', ' ').slice(0, 19); // legacy CURRENT_TIMESTAMP format

function seed() {
  const db = makeD1();
  const r2 = makeR2();
  db.exec.exec("INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (1, 'rose', 'Rose', 'classic', 150000)");
  return { db, r2 };
}
// Order <id> with invitation <id> (status inv) holding one photo, plus a receipt object
async function order(db, r2, id, status, { deadline = null, updated = null, inv = 'pending' } = {}) {
  await r2.put(`inv/${id}/a.jpg`, 'x');
  await r2.put(`receipts/${id}/1.jpg`, 'r');
  db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash) VALUES (?, 1, ?, 'blush', '{}', ?, ?, '2027-01-01', ?)")
    .run(id, `s-${id}`, JSON.stringify([`inv/${id}/a.jpg`]), inv, `h${id}`);
  db.exec.prepare('INSERT INTO orders (id, product_id, customer_email, amount_centavos, status, reference, payment_deadline, provider, updated_at) VALUES (?, ?, ?, 150000, ?, ?, ?, ?, ?)')
    .run(id, id, `c${id}@x.com`, status, `JLC-AAAA${id}2`, deadline, 'manual_gcash', updated);
}
const status = (db, id) => db.exec.prepare('SELECT status FROM orders WHERE id = ?').get(id).status;
const invExists = (db, id) => !!db.exec.prepare('SELECT 1 FROM invitations WHERE id = ?').get(id);
const has = (r2, k) => r2.map.has(k);

test('cleanup cancels a pending_payment order 1 minute past its deadline and leaves payment_verification alone', async () => {
  const { db, r2 } = seed();
  await order(db, r2, 1, 'pending_payment', { deadline: iso(MIN) });
  await order(db, r2, 2, 'payment_verification', { deadline: iso(MIN) });
  await order(db, r2, 3, 'pending_payment', { deadline: iso(-MIN) });
  assert.deepEqual(await runCleanup(db, r2, NOW), { expiredOrders: 1, purgedInvitations: 0, purgedReceipts: 0 });
  assert.equal(status(db, 1), 'cancelled');
  assert.equal(invExists(db, 1), false);
  assert.equal(has(r2, 'inv/1/a.jpg'), false);
  assert.equal(status(db, 2), 'payment_verification');
  assert.ok(invExists(db, 2) && has(r2, 'inv/2/a.jpg'));
  assert.equal(status(db, 3), 'pending_payment');
  assert.ok(invExists(db, 3));
  assert.deepEqual(await runCleanup(db, r2, NOW), { expiredOrders: 0, purgedInvitations: 0, purgedReceipts: 0 }, 'idempotent');
});

test('cleanup finishes a cancelled order whose invitation is still pending, and never touches other statuses', async () => {
  const { db, r2 } = seed();
  await order(db, r2, 1, 'cancelled', { updated: iso(DAY) });
  await order(db, r2, 2, 'payment_verification', { inv: 'pending' });
  await order(db, r2, 3, 'delivered', { inv: 'live' });
  await runCleanup(db, r2, NOW);
  assert.equal(invExists(db, 1), false);
  assert.equal(has(r2, 'inv/1/a.jpg'), false);
  assert.equal(has(r2, 'receipts/1/1.jpg'), true, 'recent cancellation keeps receipts');
  assert.ok(invExists(db, 2) && invExists(db, 3));
  assert.ok(has(r2, 'inv/2/a.jpg') && has(r2, 'inv/3/a.jpg'));
});

test('an R2 failure keeps the invitation row; the next run finishes it', async () => {
  const { db, r2 } = seed();
  await order(db, r2, 1, 'pending_payment', { deadline: iso(MIN) });
  const del = r2.delete;
  r2.delete = async () => { throw new Error('R2 down'); };
  const err = console.error; console.error = () => {};
  try { await runCleanup(db, r2, NOW); } finally { console.error = err; }
  assert.equal(status(db, 1), 'cancelled');
  assert.ok(invExists(db, 1), 'row kept while its photos remain');
  r2.delete = del;
  await runCleanup(db, r2, NOW);
  assert.equal(invExists(db, 1), false);
  assert.equal(has(r2, 'inv/1/a.jpg'), false);
});

test('receipts of an order cancelled > 60 days ago are deleted; others are kept', async () => {
  const { db, r2 } = seed();
  await order(db, r2, 1, 'cancelled', { updated: iso(61 * DAY), inv: 'expired' }); // ISO updated_at
  await order(db, r2, 2, 'cancelled', { updated: sqlTs(61 * DAY), inv: 'expired' }); // legacy format
  await order(db, r2, 3, 'cancelled', { updated: iso(59 * DAY), inv: 'expired' });
  await order(db, r2, 4, 'delivered', { updated: iso(200 * DAY), inv: 'live' });
  await order(db, r2, 5, 'refunded', { updated: iso(200 * DAY), inv: 'refunded' });
  assert.deepEqual(await runCleanup(db, r2, NOW), { expiredOrders: 0, purgedInvitations: 0, purgedReceipts: 2 });
  assert.equal(has(r2, 'receipts/1/1.jpg'), false);
  assert.equal(has(r2, 'receipts/2/1.jpg'), false);
  for (const id of [3, 4, 5]) assert.equal(has(r2, `receipts/${id}/1.jpg`), true, `order ${id}`);
  assert.equal((await runCleanup(db, r2, NOW)).purgedReceipts, 0, 'idempotent');
});

test('receipt purge pages through R2: all old-cancelled keys go, others stay, second run deletes nothing', async () => {
  const { db, r2 } = seed();
  const store = makeR2({ pageSize: 3 });
  await order(db, store, 1, 'cancelled', { updated: iso(61 * DAY), inv: 'expired' });
  await order(db, store, 2, 'delivered', { updated: iso(200 * DAY), inv: 'live' });
  for (let n = 2; n <= 8; n++) await store.put(`receipts/1/${n}.jpg`, 'r'); // 8 receipts for order 1
  for (let n = 2; n <= 5; n++) await store.put(`receipts/2/${n}.jpg`, 'r');
  assert.equal((await runCleanup(db, store, NOW)).purgedReceipts, 8);
  assert.deepEqual([...store.map.keys()].filter((k) => k.startsWith('receipts/1/')), []);
  assert.equal([...store.map.keys()].filter((k) => k.startsWith('receipts/2/')).length, 5);
  assert.equal((await runCleanup(db, store, NOW)).purgedReceipts, 0);
});

test('a purged invitation loses its guests and gift QR object; a kept one keeps both', async () => {
  const { db, r2 } = seed();
  for (const [id, date] of [[1, '2026-01-01'], [2, '2099-01-01']]) {
    await r2.put(`gift/${id}.png`, 'qr');
    db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, gift_qr) VALUES (?, 1, ?, 'blush', ?, '[]', 'live', ?, ?, ?)")
      .run(id, `s-${id}`, JSON.stringify({ partner1: 'A', partner2: 'B', eventDate: date }), date, `h${id}`, `gift/${id}.png`);
    db.exec.prepare("INSERT INTO invitation_guests (invitation_id, token, name) VALUES (?, ?, 'Guest')").run(id, `t${id}`);
  }
  assert.equal((await runCleanup(db, r2, NOW)).purgedInvitations, 1);
  const q = (sql, id) => db.exec.prepare(sql).get(id);
  assert.equal(q('SELECT COUNT(*) AS n FROM invitation_guests WHERE invitation_id = ?', 1).n, 0);
  assert.equal(q('SELECT gift_qr FROM invitations WHERE id = ?', 1).gift_qr, null);
  assert.equal(has(r2, 'gift/1.png'), false);
  assert.equal(q('SELECT COUNT(*) AS n FROM invitation_guests WHERE invitation_id = ?', 2).n, 1);
  assert.equal(q('SELECT gift_qr FROM invitations WHERE id = ?', 2).gift_qr, 'gift/2.png');
  assert.equal(has(r2, 'gift/2.png'), true);
});

test('a purged invitation loses its own music object and columns; a kept one keeps them', async () => {
  const { db, r2 } = seed();
  for (const [id, date] of [[1, '2026-01-01'], [2, '2099-01-01']]) {
    await r2.put(`inv/${id}/music-1.mp3`, 'm');
    db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, music_key, music_title) VALUES (?, 1, ?, 'blush', ?, '[]', 'live', ?, ?, ?, 'Song')")
      .run(id, `s-${id}`, JSON.stringify({ partner1: 'A', partner2: 'B', eventDate: date }), date, `h${id}`, `inv/${id}/music-1.mp3`);
  }
  assert.equal((await runCleanup(db, r2, NOW)).purgedInvitations, 1);
  const q = (id) => db.exec.prepare('SELECT music_key, music_title FROM invitations WHERE id = ?').get(id);
  assert.deepEqual({ ...q(1) }, { music_key: null, music_title: null });
  assert.equal(has(r2, 'inv/1/music-1.mp3'), false);
  assert.equal(q(2).music_key, 'inv/2/music-1.mp3');
  assert.equal(has(r2, 'inv/2/music-1.mp3'), true);
});

test('cleanup deletes expired customer sessions and login codes and keeps valid ones', async () => {
  const { db, r2 } = seed();
  const past = iso(MIN), future = new Date(NOW.getTime() + MIN).toISOString();
  for (const [h, e] of [['old', past], ['new', future]]) {
    db.exec.prepare('INSERT INTO customer_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').run(h, 'a@x.com', e);
    db.exec.prepare('INSERT INTO customer_login_codes (email, code_hash, expires_at) VALUES (?, ?, ?)').run(h + '@x.com', 'c', e);
  }
  await runCleanup(db, r2, NOW);
  assert.deepEqual(db.exec.prepare('SELECT token_hash FROM customer_sessions').all().map((r) => r.token_hash), ['new']);
  assert.deepEqual(db.exec.prepare('SELECT email FROM customer_login_codes').all().map((r) => r.email), ['new@x.com']);
});
