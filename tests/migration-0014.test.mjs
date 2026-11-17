// Migration 0014 (music, reviews, promos, alert email) and the two new permissions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { can } = await bundle('server/permissions.ts');
const cols = (db, t) => db.exec.prepare('SELECT name FROM pragma_table_info(?)').all(t).map((r) => r.name);

test('0014 adds the columns and tables', () => {
  const db = makeD1();
  assert.ok(['music_key', 'music_title'].every((c) => cols(db, 'invitations').includes(c)));
  assert.ok(['promo_code', 'discount_centavos'].every((c) => cols(db, 'orders').includes(c)));
  assert.ok(cols(db, 'smtp_settings').includes('order_alert_email'));
  assert.ok(['code', 'discount_type', 'discount_value', 'min_purchase_centavos', 'starts_at', 'expires_at', 'max_uses', 'active', 'created_at'].every((c) => cols(db, 'promo_codes').includes(c)));
  assert.ok(['customer_email', 'rating', 'status', 'reject_reason', 'moderated_by'].every((c) => cols(db, 'reviews').includes(c)));
});

test('promo_codes rejects a bad type and a duplicate code; defaults apply', () => {
  const { exec } = makeD1();
  const ins = (code, type) => exec.prepare('INSERT INTO promo_codes (code, discount_type, discount_value) VALUES (?, ?, 10)').run(code, type);
  ins('SAVE10', 'percent');
  assert.throws(() => ins('BAD', 'bogus'), /CHECK/);
  assert.throws(() => ins('SAVE10', 'fixed'), /UNIQUE/);
  const r = exec.prepare("SELECT active, min_purchase_centavos, description, max_uses FROM promo_codes WHERE code = 'SAVE10'").get();
  assert.deepEqual({ ...r }, { active: 1, min_purchase_centavos: 0, description: '', max_uses: null });
});

test('reviews enforces rating 1-5, status values and one per customer', () => {
  const { exec } = makeD1();
  const ins = (email, rating, status = 'pending') => exec.prepare('INSERT INTO reviews (customer_email, display_name, rating, body, status) VALUES (?, ?, ?, ?, ?)').run(email, 'A', rating, 'x'.repeat(20), status);
  ins('a@x.com', 5);
  assert.throws(() => ins('b@x.com', 0), /CHECK/);
  assert.throws(() => ins('b@x.com', 6), /CHECK/);
  assert.throws(() => ins('b@x.com', 3, 'hidden'), /CHECK/);
  assert.throws(() => ins('a@x.com', 4), /UNIQUE/);
  assert.equal(exec.prepare("SELECT status FROM reviews WHERE customer_email = 'a@x.com'").get().status, 'pending');
});

test('promos.manage and reviews.manage: Super Admin and Administrator only', () => {
  for (const a of ['promos.manage', 'reviews.manage']) {
    assert.equal(can('Super Admin', a), true);
    assert.equal(can('Administrator', a), true);
    assert.equal(can('Editor', a), false);
    assert.equal(can('nobody', a), false);
  }
});
