// Migration 0009: five new designs, inactive, valid, hidden from the public list until activated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, applyMigration } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { validateDesign } = await bundle('server/designs.ts');
const { onRequest: pub } = await bundle('functions/api/invitations/[[path]].ts');
const SLUGS = ['portrait-wedding', 'editorial-wedding', 'minimal-wedding', 'starlight-debut', 'pastel-birthday'];
const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const list = async (db) => (await (await pub({ request: new Request('https://shop.test/api/invitations/designs'), env: { DB: db }, waitUntil() {} })).json()).designs;

test('0009 inserts five valid inactive designs, idempotently, hidden until activated', async () => {
  const db = makeD1();
  applyMigration(db.exec, 'migrations/0009_new_designs.sql');
  const rows = db.exec.prepare(`SELECT * FROM products_designs WHERE slug IN (${SLUGS.map(() => '?').join(',')}) ORDER BY id`).all(...SLUGS);
  assert.deepEqual(rows.map((r) => r.slug), SLUGS);
  for (const r of rows) {
    assert.equal(r.active, 0);
    assert.equal(r.featured, 0);
    const schemes = JSON.parse(r.color_schemes);
    assert.ok(schemes.length >= 2 && schemes.length <= 3);
    for (const s of schemes) assert.ok(ratio(s.text, s.background) >= 4.5, `${r.slug} ${s.name} text contrast`);
    const v = validateDesign({ slug: r.slug, name: r.name, productType: r.product_type, layoutKey: r.layout_key, colorSchemes: schemes,
      previewImages: JSON.parse(r.preview_images), description: r.description, sampleDetails: JSON.parse(r.sample_details), packages: JSON.parse(r.packages), active: false });
    assert.equal(v.ok, true, v.error);
    assert.equal(v.d.price_centavos, 99900);
  }
  const before = db.exec.prepare('SELECT COUNT(*) c FROM products_designs').get().c;
  applyMigration(db.exec, 'migrations/0009_new_designs.sql');
  assert.equal(db.exec.prepare('SELECT COUNT(*) c FROM products_designs').get().c, before);
  assert.equal((await list(db)).filter((d) => SLUGS.includes(d.slug)).length, 0);
  db.exec.prepare("UPDATE products_designs SET active = 1 WHERE slug = 'portrait-wedding'").run();
  assert.deepEqual((await list(db)).filter((d) => SLUGS.includes(d.slug)).map((d) => d.slug), ['portrait-wedding']);
});
