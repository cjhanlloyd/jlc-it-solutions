// Migration 0006 applied over a pre-0006 DB: packages/orders backfill, invitation FAQs, new tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { makeD1, applyMigration } from './helpers/d1.mjs';

test('0006 backfills packages, orders and FAQs, and adds content tables', () => {
  const { exec: db } = makeD1({ migrations: false });
  for (const f of readdirSync('migrations').sort()) if (parseInt(f, 10) > 2 && parseInt(f, 10) < 6) applyMigration(db, `migrations/${f}`);
  db.prepare("INSERT INTO products_designs (slug, name, layout_key, price_centavos) VALUES ('a', 'A', 'l', 149900)").run();
  db.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos) VALUES (1, 'a@x.com', 149900)").run();
  db.prepare("INSERT INTO faqs (id, question, answer) VALUES ('it-1', 'q', 'a')").run();
  applyMigration(db, 'migrations/0006_packages_content.sql');
  const pk = JSON.parse(db.prepare('SELECT packages FROM products_designs').get().packages);
  assert.equal(pk.length, 1);
  assert.deepEqual({ ...pk[0], inclusions: pk[0].inclusions.length }, { key: 'standard', name: 'Standard', priceCentavos: 149900, inclusions: 6, kind: 'template' });
  const o = db.prepare('SELECT package_key k, package_name n FROM orders').get();
  assert.deepEqual({ ...o }, { k: 'standard', n: 'Standard' });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM faqs WHERE category = 'invitations'").get().c, 7);
  assert.match(db.prepare("SELECT answer a FROM faqs WHERE id = 'inv-6'").get().a, /\]\(\/refund-policy\)/);
  assert.equal(db.prepare("SELECT category c FROM faqs WHERE id = 'it-1'").get().c, 'it');
  assert.equal(db.prepare('SELECT active a FROM site_banner WHERE id = ?').get('default').a, 0);
  for (const t of ['testimonials', 'site_content']) db.prepare(`SELECT 1 FROM ${t}`).all();
});
