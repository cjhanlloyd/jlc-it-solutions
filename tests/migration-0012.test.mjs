// Migrations 0011 (tier column, music_tracks) and 0012 (tier packages, prices, descriptions for the eight live designs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, applyMigration } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { validateDesign } = await bundle('server/designs.ts');
const EXPECT = {
  wedding: [149900, 'standard'], 'minimal-wedding': [149900, 'standard'], debut: [129900, 'standard'], birthday: [99900, 'standard'],
  'portrait-wedding': [299900, 'premium'], 'editorial-wedding': [299900, 'premium'], 'starlight-debut': [249900, 'premium'], 'pastel-birthday': [199900, 'premium'],
};
// The four original designs only exist in the live database, so stand them in by copying a seeded row.
const LIVE = [['wedding', 'Wedding Invitation', 'classic', 'wedding_invitation'], ['debut', 'Debut Invitation', 'blush', 'debut_invitation'], ['birthday', 'Birthday Invitation', 'confetti', 'birthday_invitation']];
const SEEDED = { wedding_invitation: 'portrait-wedding', debut_invitation: 'starlight-debut', birthday_invitation: 'pastel-birthday' };
const rows = (db) => db.exec.prepare('SELECT * FROM products_designs ORDER BY id').all().filter((r) => r.slug in EXPECT);

test('0011 adds invitations.tier (default standard) and music_tracks', () => {
  const db = makeD1();
  const cols = db.exec.prepare('SELECT name, dflt_value FROM pragma_table_info(?)');
  assert.equal(cols.all('invitations').find((c) => c.name === 'tier')?.dflt_value, "'standard'");
  assert.deepEqual(cols.all('music_tracks').map((c) => c.name), ['id', 'title', 'credit', 'r2_key', 'active', 'sort_order', 'created_at']);
});

test('0012 prices and tiers all eight designs with valid packages, and is re-runnable', () => {
  const db = makeD1();
  applyMigration(db.exec, 'migrations/0009_new_designs.sql');
  for (const [slug, name, layout, type] of LIVE) {
    db.exec.prepare(`INSERT INTO products_designs (product_type, slug, name, layout_key, price_centavos, color_schemes, preview_images, sample_details, active, sort_order, description, featured, packages)
      SELECT ?, ?, ?, ?, 99900, color_schemes, '[]', sample_details, 1, sort_order, '', 0, '[]' FROM products_designs WHERE slug = ?`).run(type, slug, name, layout, SEEDED[type]);
  }
  applyMigration(db.exec, 'migrations/0012_tier_prices.sql');
  const snap = () => JSON.stringify(rows(db));
  assert.equal(rows(db).length, 8);
  for (const r of rows(db)) {
    const [price, tier] = EXPECT[r.slug];
    const pk = JSON.parse(r.packages);
    assert.equal(r.price_centavos, price);
    assert.equal(pk.length, 1);
    assert.equal(pk[0].key, tier);
    assert.equal(pk[0].tier, tier);
    assert.equal(pk[0].priceCentavos, price);
    assert.ok(r.description.length > 0 && r.description.length < 300);
    assert.ok(!/bubbly/i.test(r.description), 'no design-specific animation claims');
    const v = validateDesign({ slug: r.slug, name: r.name, productType: r.product_type, layoutKey: r.layout_key, colorSchemes: JSON.parse(r.color_schemes),
      previewImages: JSON.parse(r.preview_images), description: r.description, sampleDetails: JSON.parse(r.sample_details), packages: pk, active: !!r.active });
    assert.equal(v.ok, true, `${r.slug}: ${v.error}`);
  }
  const before = snap();
  applyMigration(db.exec, 'migrations/0012_tier_prices.sql');
  assert.equal(snap(), before);
});
