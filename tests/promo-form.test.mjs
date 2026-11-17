import test from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { manilaToIso, isoToManila, promoStatus, validityText, pesoText } = await bundle('src/admin/promo-form.ts');

test('Manila time converts to UTC and back', () => {
  assert.equal(manilaToIso('2026-12-31', '09:30'), '2026-12-31T01:30:00.000Z');
  assert.equal(manilaToIso('2026-12-01', ''), '2026-11-30T16:00:00.000Z');
  assert.deepEqual(isoToManila('2026-12-31T01:30:00.000Z'), { date: '2026-12-31', time: '09:30' });
  assert.equal(manilaToIso('', '10:00'), null);
});

test('an expiry with only a date is the end of that Manila day, and round-trips', () => {
  const iso = manilaToIso('2026-12-31', '', true);
  assert.equal(iso, '2026-12-31T15:59:59.000Z');
  assert.deepEqual(isoToManila(iso), { date: '2026-12-31', time: '' });
});

test('status from flags, dates and uses', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const base = { active: true, startsAt: null, expiresAt: null, maxUses: null, uses: 0 };
  assert.equal(promoStatus(base, now), 'Active');
  assert.equal(promoStatus({ ...base, active: false }, now), 'Inactive');
  assert.equal(promoStatus({ ...base, expiresAt: '2026-05-01T00:00:00Z' }, now), 'Expired');
  assert.equal(promoStatus({ ...base, startsAt: '2026-07-01T00:00:00Z' }, now), 'Scheduled');
  assert.equal(promoStatus({ ...base, maxUses: 5, uses: 5 }, now), 'Used up');
});

test('validity and money text', () => {
  assert.equal(validityText(null, '2026-12-31T15:59:59.000Z'), 'Until Dec 31, 2026');
  assert.equal(validityText(null, null), 'No end date');
  assert.equal(pesoText(20000), '₱200');
  assert.equal(pesoText(12550), '₱125.50');
});
