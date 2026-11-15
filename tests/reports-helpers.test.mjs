// Shared report helpers: Manila range bounds, paid-at rule, month key, median.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { parseRange, paidAtSql, manilaMonthKey, median } = await bundle('server/reports.ts');

test('parseRange: Manila day bounds in ISO and SQL UTC', () => {
  const r = parseRange('2026-11-01', '2026-11-30');
  assert.equal(r.fromIso, '2026-10-31T16:00:00.000Z');
  assert.equal(r.fromSql, '2026-10-31 16:00:00');
  assert.equal(r.toIsoExclusive, '2026-11-30T16:00:00.000Z');
  assert.equal(r.toSqlExclusive, '2026-11-30 16:00:00');
  assert.equal(r.days, 30);
  assert.equal(parseRange('2026-11-15', '2026-11-15').days, 1);
});

test('parseRange: the three errors', () => {
  assert.equal(parseRange('2026-11-30', '2026-11-01').error, 'The start date must be before the end date.');
  assert.equal(parseRange('2026-01-01', '2027-01-02').error, 'Choose a range of 366 days or less.');
  assert.equal(parseRange('2026-01-01', '2027-01-01').error, undefined); // 366 days
  for (const bad of [null, '', '2026-13-01', '2026-02-30', '11/15/2026']) assert.equal(parseRange(bad, '2026-11-15').error, 'Use dates like 2026-11-15.');
});

test('manilaMonthKey and median', () => {
  assert.equal(manilaMonthKey('2026-10-31T16:00:00.000Z'), '2026-11');
  assert.equal(manilaMonthKey('2026-10-31T15:59:59.000Z'), '2026-10');
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('paidAtSql: event, else delivered_at, else created_at, all ISO-comparable', () => {
  const db = makeD1();
  let k = 0;
  const add = (created, delivered) => Number(db.exec.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, created_at, delivered_at) VALUES (1, 'c@x.com', 1, 'delivered', ?, 'manual_gcash', ?, ?)").run(`R${++k}`, created, delivered).lastInsertRowid);
  const ev = add('2026-11-01 00:00:00', '2026-11-05T00:00:00.000Z');
  db.exec.prepare("INSERT INTO order_events (order_id, at, actor, kind, to_status, note, visible) VALUES (?, '2026-11-03T00:00:00.000Z', 's', 'status', 'payment_confirmed', 'n', 0)").run(ev);
  const legacy = add('2026-11-01 00:00:00', '2026-11-05T00:00:00.000Z');
  const bare = add('2026-10-31 16:00:00', null);
  const paid = Object.fromEntries(db.exec.prepare(`SELECT o.id, ${paidAtSql('o')} AS p FROM orders o`).all().map((r) => [r.id, r.p]));
  assert.equal(paid[ev], '2026-11-03T00:00:00.000Z');
  assert.equal(paid[legacy], '2026-11-05T00:00:00.000Z');
  assert.equal(paid[bare], '2026-10-31T16:00:00.000Z');
  // created_at fallback sits exactly on an ISO bound: in on the lower edge, out on the upper
  const r = parseRange('2026-11-01', '2026-11-01');
  assert.ok(paid[bare] >= r.fromIso && paid[bare] < r.toIsoExclusive);
});
