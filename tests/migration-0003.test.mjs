// Migration 0003 applied over a pre-0003 DB: status mapping, legacy references, customers backfill, settings seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, applyMigration } from './helpers/d1.mjs';

test('0003 maps legacy orders and seeds GCash tables', () => {
  const { exec: db } = makeD1({ migrations: false });
  const ins = db.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, paid_at) VALUES (1, ?, 100, ?, ?)");
  ins.run('A@x.com', 'paid', '2026-01-01 00:00:00');
  ins.run('a@x.com', 'pending', null);
  ins.run('b@x.com', 'refunded', null);
  applyMigration(db, 'migrations/0003_orders_gcash.sql');
  const rows = db.prepare('SELECT * FROM orders ORDER BY id').all();
  assert.deepEqual(rows.map((r) => r.status), ['delivered', 'cancelled', 'refunded']);
  assert.equal(rows[0].delivered_at, '2026-01-01 00:00:00');
  for (const r of rows) {
    assert.match(r.reference, /^JLC-/);
    assert.ok(r.customer_id);
    assert.equal(r.provider, 'paymongo');
  }
  assert.equal(new Set(rows.map((r) => r.reference)).size, 3);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM customers').get().c, 2);
  const s = db.prepare('SELECT * FROM payment_settings').all();
  assert.equal(s.length, 1);
  assert.equal(s[0].deadline_hours, 48);
  for (const t of ['payments', 'order_events']) db.prepare(`SELECT 1 FROM ${t}`).all();
});

test('0004 remaps orders stranded by the old code after 0003, and is idempotent', () => {
  const { exec: db } = makeD1();
  const ins = db.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, paid_at) VALUES (1, ?, 100, ?, ?)");
  ins.run('A@x.com', 'paid', '2026-01-01 00:00:00');
  ins.run('b@x.com', 'pending', null);
  applyMigration(db, 'migrations/0004_remap_legacy.sql');
  const snap = () => db.prepare('SELECT * FROM orders ORDER BY id').all();
  const rows = snap();
  assert.deepEqual(rows.map((r) => r.status), ['delivered', 'cancelled']);
  assert.equal(rows[0].delivered_at, '2026-01-01 00:00:00');
  for (const r of rows) { assert.match(r.reference, /^JLC-/); assert.ok(r.customer_id); }
  applyMigration(db, 'migrations/0004_remap_legacy.sql');
  assert.deepEqual(snap(), rows);
});
