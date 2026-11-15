// Admin dashboard: counts, Manila-time revenue, Editor scope, on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest, dashboardData } = await bundle('functions/api/admin/dashboard.ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
let db, n;
beforeEach(() => {
  db = makeD1();
  n = 0;
  for (const [name, role] of [['adm', 'Administrator'], ['ed', 'Editor']]) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
});

// created: SQLite format; confirmedAt: ISO time of the payment_confirmed event (optional)
const addOrder = (status, { created = '2026-11-14 01:00:00', amount = 100000, assigned = null, confirmedAt, product = 1 } = {}) => {
  n++;
  const id = Number(db.exec.prepare('INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, created_at, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(product, `c${n}@x.com`, amount, status, `JLC-${n}`, 'manual_gcash', created, assigned).lastInsertRowid);
  if (confirmedAt) event(id, 'payment_confirmed', confirmedAt);
  return id;
};
const event = (id, to, at, kind = 'status') => db.exec.prepare('INSERT INTO order_events (order_id, at, actor, kind, to_status, note, visible) VALUES (?, ?, ?, ?, ?, ?, 0)').run(id, at, 'sys', kind, to, 'n');

// 2026-11-14 12:00 Manila = 04:00Z. Month = [2025-10-31T16:00Z, 2026-11-30T16:00Z)
const NOW = new Date('2026-11-14T04:00:00Z');

test('counts, new orders (Manila today / 7 days) and pending payments', async () => {
  addOrder('payment_verification', { created: '2026-11-13 17:00:00' }); // 01:00 Manila today
  addOrder('for_review', { created: '2026-11-13 15:59:59' }); // 23:59 Manila yesterday
  addOrder('revision_requested', { created: '2026-11-07 15:59:59' }); // 7 days back, 1 s outside
  addOrder('pending_payment', { created: '2026-11-07 16:00:00' }); // exactly 6 Manila days before today → in
  const d = await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW);
  assert.deepEqual(d.needsAction, { paymentVerification: 1, forReview: 1, revisionRequested: 1 });
  assert.deepEqual(d.newOrders, { today: 1, last7: 3 });
  assert.equal(d.pendingPayments.count, 1);
  assert.equal(d.money.pendingCentavos, 100000);
  assert.equal(d.statusCounts.for_review, 1);
  assert.equal(d.statusCounts.delivered, 0);
});

test('revenue: Manila month edges, refunded and other months excluded, once per order', async () => {
  addOrder('delivered', { amount: 100000, confirmedAt: '2026-10-31T16:00:00.000Z' }); // 00:00 Manila Nov 1 → this month
  addOrder('in_production', { amount: 50000, confirmedAt: '2026-11-10T00:00:00.000Z' });
  addOrder('refunded', { amount: 70000, confirmedAt: '2026-11-10T00:00:00.000Z' });
  addOrder('delivered', { amount: 30000, confirmedAt: '2026-10-31T15:59:59.000Z' }); // last month
  const twice = addOrder('completed', { amount: 20000, confirmedAt: '2026-11-11T00:00:00.000Z' });
  event(twice, 'payment_confirmed', '2026-11-12T00:00:00.000Z');
  event(twice, 'delivered', '2026-11-13T00:00:00.000Z');
  const d = await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW);
  assert.deepEqual(d.money.thisMonth, { revenueCentavos: 170000, delivered: 1, averageCentavos: 56667 });
  assert.deepEqual(d.money.lastMonth, { revenueCentavos: 30000, delivered: 0, averageCentavos: 30000 });
});

test('revenue: legacy delivered order with no events counts in its delivered_at month; created_at-only fallback too', async () => {
  const id = addOrder('delivered', { amount: 40000, created: '2026-09-01 00:00:00' });
  db.exec.prepare('UPDATE orders SET delivered_at = ? WHERE id = ?').run('2026-11-05T00:00:00.000Z', id);
  addOrder('in_production', { amount: 10000, created: '2026-10-31 16:00:00' }); // 00:00 Manila Nov 1, no events
  addOrder('in_production', { amount: 5000, created: '2026-10-31 15:59:59' }); // last month
  const d = await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW);
  assert.deepEqual(d.money.thisMonth, { revenueCentavos: 50000, delivered: 0, averageCentavos: 25000 });
  assert.equal(d.money.lastMonth.revenueCentavos, 5000);
});

test('recent activity: newest first, max 15, with reference and label', async () => {
  const id = addOrder('delivered');
  for (let i = 0; i < 20; i++) event(id, 'in_production', `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`);
  event(id, 'delivered', '2026-11-28T00:00:00.000Z');
  const { recent } = await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW);
  assert.equal(recent.length, 15);
  assert.deepEqual(recent[0], { at: '2026-11-28T00:00:00.000Z', reference: 'JLC-1', orderId: id, label: 'Delivered', actor: 'sys' });
});

test('Editor: no money, counts and recent limited to scope', async () => {
  const mine = addOrder('for_review', { assigned: 'ed@jlc.test' });
  addOrder('for_review', { assigned: 'adm@jlc.test' });
  addOrder('payment_verification'); // unassigned but not paid → hidden
  const open = addOrder('for_review'); // unassigned and paid → visible
  event(mine, 'for_review', '2026-11-14T00:00:00.000Z');
  event(open, 'for_review', '2026-11-13T00:00:00.000Z');
  event(3, 'payment_verification', '2026-11-12T00:00:00.000Z');
  const d = await dashboardData(db, 'Editor', 'ed@jlc.test', NOW);
  assert.equal('money' in d, false);
  assert.equal(d.needsAction.forReview, 2);
  assert.equal(d.needsAction.paymentVerification, 0);
  assert.deepEqual(d.recent.map((r) => r.orderId), [mine, open]);
});

test('endpoint: 401 without a token, money in the JSON only with reports.view', async () => {
  const call = async (as) => onRequest({ request: new Request('https://shop.test/api/admin/dashboard', { headers: as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {} }), env: { DB: db, PHOTOS: makeR2(), JWT_SECRET: SECRET } });
  assert.equal((await call()).status, 401);
  assert.ok('money' in await (await call('adm')).json());
  assert.equal('money' in await (await call('ed')).json(), false);
});

test('a skipped migration: Super Admin sees a named warning, Administrator does not', async () => {
  db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES ('sa@jlc.test', 'sa', 'Super Admin', 'Active', 1, 't')").run();
  const call = async (as) => (await onRequest({ request: new Request('https://shop.test/api/admin/dashboard', { headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }), env: { DB: db, PHOTOS: makeR2(), JWT_SECRET: SECRET } })).json();
  assert.equal((await call('sa')).schemaWarning, undefined);
  await db.prepare('DROP TABLE order_proofs').run();
  assert.match((await call('sa')).schemaWarning, /missing migration 0007_custom_orders/);
  assert.equal((await call('adm')).schemaWarning, undefined);
});

const reports = await bundle('functions/api/admin/reports/[[path]].ts');
const sum = (a) => a.reduce((x, y) => x + y, 0);

test('charts: bucket counts, Manila day edges, custom split', async () => {
  addOrder('for_review', { created: '2026-11-08 15:59:00' }); // 23:59 Manila Nov 8 → first day of 7d
  const c = addOrder('for_review', { created: '2026-11-08 16:01:00' }); // 00:01 Nov 9
  db.exec.prepare("UPDATE orders SET package_kind = 'custom' WHERE id = ?").run(c);
  addOrder('for_review', { created: '2026-11-07 15:59:00' }); // before range
  const d = (await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW, '7d')).charts;
  assert.equal(d.buckets.length, 7);
  assert.equal(d.buckets[0], '2026-11-08');
  assert.deepEqual(d.orders.template, [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(d.orders.custom, [0, 1, 0, 0, 0, 0, 0]);
  assert.equal(d.statusMix.find((s) => s.status === 'for_review').count, 2);
  const y = (await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW, '12m')).charts;
  assert.equal(y.buckets.length, 12);
  assert.deepEqual([y.buckets[0], y.buckets[11]], ['2025-12', '2026-11']);
  assert.equal(y.orders.template[11], 2);
});

test('charts: revenue total equals Reports revenue across two months; payments and top designs', async () => {
  addOrder('delivered', { amount: 100000, confirmedAt: '2026-10-31T16:00:00.000Z' }); // Nov 1 Manila
  addOrder('in_production', { amount: 50000, confirmedAt: '2026-10-31T15:59:00.000Z' }); // Oct 31 Manila
  addOrder('refunded', { amount: 70000, confirmedAt: '2026-11-10T00:00:00.000Z' });
  addOrder('delivered', { amount: 30000, confirmedAt: '2026-10-10T00:00:00.000Z' }); // before range
  db.exec.prepare("INSERT INTO payments (order_id, provider, amount_centavos, status, submitted_at) VALUES (1, 'manual_gcash', 1, 'confirmed', '2026-11-10T00:00:00.000Z')").run();
  const c = (await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW, '30d')).charts;
  assert.equal(c.buckets[0], '2026-10-16');
  assert.equal(c.revenue[c.buckets.indexOf('2026-10-31')], 50000);
  assert.equal(c.revenue[c.buckets.indexOf('2026-11-01')], 100000);
  const res = await reports.onRequest({ request: new Request('https://shop.test/api/admin/reports?from=2026-10-16&to=2026-11-14', { headers: { Authorization: 'Bearer ' + await signAdminToken('adm@jlc.test', SECRET) } }), env: { DB: db, JWT_SECRET: SECRET } });
  assert.equal(sum(c.revenue), (await res.json()).sales.revenueCentavos);
  assert.equal(c.payments.confirmed, 1);
  assert.deepEqual(c.topDesigns, [{ name: 'Unknown design', paidOrders: 2 }]);
});

test('charts: Editor gets no money keys and only scoped orders; bad range is 400', async () => {
  addOrder('for_review', { assigned: 'ed@jlc.test' });
  addOrder('for_review', { assigned: 'adm@jlc.test' });
  const c = (await dashboardData(db, 'Editor', 'ed@jlc.test', NOW, '7d')).charts;
  for (const k of ['revenue', 'payments', 'topDesigns']) assert.equal(k in c, false);
  assert.equal(sum(c.orders.template), 1);
  const call = async (q) => onRequest({ request: new Request('https://shop.test/api/admin/dashboard' + q, { headers: { Authorization: 'Bearer ' + await signAdminToken('adm@jlc.test', SECRET) } }), env: { DB: db, JWT_SECRET: SECRET } });
  assert.equal((await call('?range=1y')).status, 400);
  assert.equal((await call('?range=90d')).status, 200);
});

test('charts: topDesigns groups by design id and matches the Reports designs order (same-name designs, tie)', async () => {
  for (const [id, slug, name] of [[1, 'a', 'Rose'], [2, 'b', 'Rose'], [3, 'c', 'Lily']]) {
    db.exec.prepare("INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (?, ?, ?, 'k', 1)").run(id, slug, name);
    db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, event_date, manage_token_hash) VALUES (?, ?, ?, 'c', '{}', 'd', ?)").run(id, id, 's' + id, 'h' + id);
  }
  const at = '2026-11-10T00:00:00.000Z';
  addOrder('delivered', { product: 1, amount: 100000, confirmedAt: at });
  addOrder('delivered', { product: 1, amount: 100000, confirmedAt: at });
  addOrder('delivered', { product: 2, amount: 50000, confirmedAt: at }); // ties Lily on count, lower revenue
  addOrder('delivered', { product: 3, amount: 90000, confirmedAt: at });
  const c = (await dashboardData(db, 'Administrator', 'adm@jlc.test', NOW, '30d')).charts;
  const res = await reports.onRequest({ request: new Request('https://shop.test/api/admin/reports?from=2026-10-16&to=2026-11-14', { headers: { Authorization: 'Bearer ' + await signAdminToken('adm@jlc.test', SECRET) } }), env: { DB: db, JWT_SECRET: SECRET } });
  const want = (await res.json()).designs.map((d) => ({ name: d.name, paidOrders: d.paidOrders }));
  assert.equal(want.length, 3);
  assert.deepEqual(c.topDesigns, want);
  assert.deepEqual(want.map((d) => d.paidOrders), [2, 1, 1]);
  assert.equal(want[1].name, 'Lily');
});

test('dashboard survives a chart failure: 200 with tiles and charts null', async () => {
  db.exec.exec('ALTER TABLE orders DROP COLUMN package_kind');
  addOrder('for_review');
  const res = await onRequest({ request: new Request('https://shop.test/api/admin/dashboard', { headers: { Authorization: 'Bearer ' + await signAdminToken('adm@jlc.test', SECRET) } }), env: { DB: db, JWT_SECRET: SECRET } });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.charts, null);
  assert.equal(d.needsAction.forReview, 1);
});
