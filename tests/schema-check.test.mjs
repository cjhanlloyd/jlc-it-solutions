// Live-database drift check: every migration has a marker, and a skipped migration is reported by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { MIGRATION_MARKERS, missingMigrations, migrationWarning } = await bundle('server/schema-check.ts');

test('every migration has a marker (add one with each new migration)', () => {
  const files = readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).map((f) => f.replace(/\.sql$/, ''));
  const marked = new Set(MIGRATION_MARKERS.map((m) => m.migration));
  assert.deepEqual(files.filter((f) => !marked.has(f)), []);
});

test('fully migrated database: nothing missing', async () => {
  assert.deepEqual(await missingMigrations(makeD1()), []);
});

test('no migrations applied: every schema migration is reported once, in order', async () => {
  assert.deepEqual(await missingMigrations(makeD1({ migrations: false })),
    ['0003_orders_gcash', '0005_design_marketing', '0006_packages_content', '0007_custom_orders', '0008_invitation_style', '0010_design_sample_photos', '0011_premium_tier', '0013_accounts_guests', '0014_music_reviews_promos']);
});

test('a skipped 0007 is reported by name with a clear message', async () => {
  const db = makeD1();
  await db.prepare('DROP TABLE order_proofs').run();
  const missing = await missingMigrations(db);
  assert.deepEqual(missing, ['0007_custom_orders']);
  assert.equal(migrationWarning(missing), 'The live database is missing migration 0007_custom_orders. Run it on the live database, then reload.');
});

test('a skipped 0002 (RSVP children count) is reported by name', async () => {
  const db = makeD1();
  await db.prepare('ALTER TABLE rsvps DROP COLUMN kids_count').run();
  assert.deepEqual(await missingMigrations(db), ['0002_occasions']);
});
