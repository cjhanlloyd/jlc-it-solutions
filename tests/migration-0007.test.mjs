// Migration 0007 applied over a pre-0007 DB: order kind/notes columns and order_proofs table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { makeD1, applyMigration } from './helpers/d1.mjs';

test('0007 keeps existing orders as template and adds order_proofs', () => {
  const { exec: db } = makeD1({ migrations: false });
  for (const f of readdirSync('migrations').sort()) if (parseInt(f, 10) > 2 && parseInt(f, 10) < 7) applyMigration(db, `migrations/${f}`);
  db.prepare("INSERT INTO products_designs (slug, name, layout_key, price_centavos) VALUES ('a', 'A', 'l', 149900)").run();
  db.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos) VALUES (1, 'a@x.com', 149900)").run();
  applyMigration(db, 'migrations/0007_custom_orders.sql');
  const o = db.prepare('SELECT package_kind k, designer_notes n FROM orders').get();
  assert.deepEqual({ ...o }, { k: 'template', n: null });
  db.prepare("INSERT INTO order_proofs (order_id, round, kind, url, created_by, created_at) VALUES (1, 1, 'link', 'https://x.com/p', 'admin', '2026-01-01')").run();
  const p = db.prepare('SELECT order_id o, round r, kind k, file_key f, message m FROM order_proofs').get();
  assert.deepEqual({ ...p }, { o: 1, r: 1, k: 'link', f: null, m: null });
});
