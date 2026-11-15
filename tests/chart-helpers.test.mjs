import test from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, bucketLabel, tickIndexes, moneyTick, doughnutArcs, arcPath, groupStatusMix, nextIndex } from '../src/admin/chart-helpers.ts';

test('nextIndex: arrows step and clamp, Home/End jump, other keys ignored', () => {
  assert.equal(nextIndex('ArrowRight', null, 5), 0);
  assert.equal(nextIndex('ArrowDown', 2, 5), 3);
  assert.equal(nextIndex('ArrowRight', 4, 5), 4);
  assert.equal(nextIndex('ArrowLeft', null, 5), 4);
  assert.equal(nextIndex('ArrowUp', 0, 5), 0);
  assert.equal(nextIndex('Home', 3, 5), 0);
  assert.equal(nextIndex('End', 0, 5), 4);
  assert.equal(nextIndex('Enter', 1, 5), undefined);
  assert.equal(nextIndex('ArrowRight', null, 0), undefined);
});

test('niceTicks: 0-based 1-2-5 steps, 4-5 ticks, covers the max', () => {
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(10), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(1234), [0, 500, 1000, 1500]);
  for (const max of [1, 3, 7, 10, 23, 99, 1234, 125000, 9_999_999]) {
    const t = niceTicks(max);
    assert.equal(t[0], 0);
    assert.ok(t.length >= 4 && t.length <= 6, `${max}: ${t}`);
    assert.ok(t.at(-1) >= max, `${max} covered by ${t}`);
    const step = t[1];
    assert.ok([1, 2, 5].includes(Math.round(step / 10 ** Math.floor(Math.log10(step) + 1e-9))), `${max}: step ${step}`);
  }
  // integer counts never get fractional ticks
  assert.deepEqual(niceTicks(2, true), [0, 1, 2]);
  assert.deepEqual(niceTicks(0), [0, 1]);
});

test('bucketLabel: days and months', () => {
  assert.equal(bucketLabel('2026-11-12'), 'Nov 12');
  assert.equal(bucketLabel('2026-01-01'), 'Jan 1');
  assert.equal(bucketLabel('2026-11'), 'Nov 2026');
});

test('tickIndexes: at most 8 labels, first always shown', () => {
  assert.deepEqual(tickIndexes(7), [0, 1, 2, 3, 4, 5, 6]);
  for (const n of [12, 30, 90]) {
    const t = tickIndexes(n);
    assert.equal(t[0], 0);
    assert.ok(t.length <= 8, `${n}: ${t.length}`);
    assert.ok(t.every((i) => i < n));
  }
  assert.deepEqual(tickIndexes(0), []);
});

test('moneyTick: pesos from centavos, k for thousands', () => {
  assert.equal(moneyTick(0), '₱0');
  assert.equal(moneyTick(50000), '₱500');
  assert.equal(moneyTick(250000), '₱2.5k');
  assert.equal(moneyTick(1000000), '₱10k');
});

test('doughnutArcs: proportions, zero slices skipped, zero total empty', () => {
  assert.deepEqual(doughnutArcs([0, 0, 0]), []);
  assert.deepEqual(doughnutArcs([]), []);
  const a = doughnutArcs([1, 0, 3]);
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((s) => s.index), [0, 2]);
  assert.equal(a[0].start, 0);
  assert.ok(Math.abs(a[0].end - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(a[1].end - 2 * Math.PI) < 1e-9);
});

test('arcPath: a full ring and a slice produce finite paths', () => {
  for (const [s, e] of [[0, 2 * Math.PI], [0, Math.PI / 2], [Math.PI, 2 * Math.PI]]) {
    const d = arcPath(50, 50, 40, 24, s, e);
    assert.ok(d.length > 0 && !d.includes('NaN'), d);
  }
});

test('groupStatusMix: five fixed slices in order, colours follow the entity', () => {
  const mix = ['pending_payment', 'payment_verification', 'payment_confirmed', 'in_production', 'for_review', 'revision_requested', 'completed', 'delivered', 'cancelled', 'refunded']
    .map((status, i) => ({ status, label: status, count: i + 1 }));
  const g = groupStatusMix(mix);
  assert.deepEqual(g.map((s) => s.label), ['Awaiting payment', 'In progress', 'Delivered', 'Cancelled', 'Refunded']);
  assert.deepEqual(g.map((s) => s.value), [1 + 2, 3 + 4 + 5 + 6 + 7, 8, 9, 10]);
  assert.deepEqual(g.map((s) => s.color), ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']);
  const z = groupStatusMix([{ status: 'delivered', label: 'Delivered', count: 2 }]);
  assert.equal(z.length, 5);
  assert.equal(z[2].value, 2);
  assert.equal(z[0].value, 0);
});
