// Admin reports API: Manila range bounds, paid-at rule, refunds, payments, designs, inquiries, permissions.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest } = await bundle('functions/api/admin/reports/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
let db, n;
beforeEach(() => {
  db = makeD1();
  n = 0;
  for (const [name, role] of [['adm', 'Administrator'], ['ed', 'Editor']]) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
  db.exec.prepare("INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (1, 'rose', 'Rose', 'k', 100000)").run();
  db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, event_date, manage_token_hash) VALUES (1, 1, 's1', 'c', '{}', 'd', 'h1')").run();
});

const addOrder = (status, { created = '2026-11-12 01:00:00', amount = 100000, confirmedAt, product = 1, pkg = 'Standard', kind = 'template', delivered = null } = {}) => {
  n++;
  const id = Number(db.exec.prepare('INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, created_at, package_name, package_kind, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(product, `c${n}@x.com`, amount, status, `JLC-${n}`, 'manual_gcash', created, pkg, kind, delivered).lastInsertRowid);
  if (confirmedAt) event(id, 'payment_confirmed', confirmedAt);
  return id;
};
const event = (id, to, at) => db.exec.prepare("INSERT INTO order_events (order_id, at, actor, kind, to_status, note, visible) VALUES (?, ?, 'sys', 'status', ?, 'n', 0)").run(id, at, to);
const pay = (orderId, status, submitted, verified = null, amount = 100000) =>
  db.exec.prepare('INSERT INTO payments (order_id, provider, amount_centavos, status, submitted_at, verified_at) VALUES (?, ?, ?, ?, ?, ?)').run(orderId, 'manual_gcash', amount, status, submitted, verified);
const inquiry = (id, o = {}) => db.exec.prepare('INSERT INTO inquiries (id, fullName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(id, 'N', 'a@b.c', '1', o.service ?? 'Web', o.desc ?? 'hi', 'email', o.status ?? 'New', o.at ?? '2026-11-12T00:00:00.000Z');

const call = async (qs = 'from=2026-11-10&to=2026-11-14', as = 'adm') => onRequest({
  request: new Request('https://shop.test/api/admin/reports?' + qs, { headers: as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {} }),
  env: { DB: db, PHOTOS: makeR2(), JWT_SECRET: SECRET },
});
const get = async (qs, as) => (await call(qs, as)).json();

test('boundary: 23:59 Manila on the last day is in, 00:01 the next day is out (SQL and ISO bounds)', async () => {
  addOrder('payment_confirmed', { created: '2026-11-14 15:59:00', confirmedAt: '2026-11-14T15:59:30.000Z', amount: 100000 });
  addOrder('payment_confirmed', { created: '2026-11-14 16:01:00', confirmedAt: '2026-11-14T16:01:30.000Z', amount: 200000 });
  const d = await get();
  assert.equal(d.sales.revenueCentavos, 100000);
  assert.equal(d.sales.paidOrders, 1);
  assert.equal(d.orders.funnel.placed, 1);
  assert.deepEqual(d.range, { from: '2026-11-10', to: '2026-11-14' });
});

test('legacy delivered order with no events counts in its delivered_at month; refunded only in refunds', async () => {
  addOrder('delivered', { created: '2026-09-01 00:00:00', delivered: '2026-11-12T00:00:00.000Z', amount: 40000 });
  const r = addOrder('refunded', { amount: 70000, confirmedAt: '2026-11-11T00:00:00.000Z' });
  event(r, 'refunded', '2026-11-13T00:00:00.000Z');
  const d = await get();
  assert.equal(d.sales.revenueCentavos, 40000);
  assert.deepEqual(d.sales.refunds, { count: 1, centavos: 70000 });
  assert.equal(d.monthly.find((m) => m.month === '2026-11').revenueCentavos, 40000);
});

test('whole-month revenue matches the dashboard, legacy delivered order included', async () => {
  addOrder('delivered', { created: '2026-09-01 00:00:00', delivered: '2026-11-12T00:00:00.000Z', amount: 40000 }); // legacy, no events
  addOrder('delivered', { confirmedAt: '2026-11-05T00:00:00.000Z', amount: 60000 });
  const { dashboardData } = await bundle('functions/api/admin/dashboard.ts');
  const dash = await dashboardData(db, 'Administrator', 'adm@jlc.test', new Date('2026-11-15T04:00:00.000Z'));
  const d = await get('from=2026-11-01&to=2026-11-30');
  assert.equal(d.sales.revenueCentavos, 100000);
  assert.equal(d.sales.revenueCentavos, dash.money.thisMonth.revenueCentavos);
});

test('awaiting is current and range-independent', async () => {
  addOrder('pending_payment', { amount: 1000, created: '2020-01-01 00:00:00' });
  addOrder('payment_verification', { amount: 500 });
  addOrder('delivered', { amount: 9999 });
  const { dashboardData } = await bundle('functions/api/admin/dashboard.ts');
  const dash = await dashboardData(db, 'Administrator', 'adm@jlc.test', new Date());
  assert.equal((await get()).sales.awaitingCentavos, 1000);
  assert.equal((await get()).sales.awaitingCentavos, dash.money.pendingCentavos);
});

test('payments: rejected and confirmed for the same order both counted; median uses the confirmed one', async () => {
  const o = addOrder('payment_confirmed', { confirmedAt: '2026-11-12T03:00:00.000Z' });
  pay(o, 'rejected', '2026-11-12T00:00:00.000Z', '2026-11-12T10:00:00.000Z');
  pay(o, 'confirmed', '2026-11-12T01:00:00.000Z', '2026-11-12T03:00:00.000Z');
  pay(o, 'submitted', '2026-11-13T00:00:00.000Z');
  const p = (await get()).payments;
  assert.deepEqual([p.confirmed.count, p.rejected.count, p.submitted.count], [1, 1, 1]);
  assert.equal(p.confirmed.centavos, 100000);
  assert.equal(p.medianConfirmHours, 2);
});

test('orders: status mix, funnel cohort, delivery medians by kind', async () => {
  addOrder('pending_payment');
  addOrder('delivered', { confirmedAt: '2026-11-12T00:00:00.000Z', delivered: '2026-11-13T00:00:00.000Z' });
  addOrder('delivered', { kind: 'custom', pkg: 'Custom', confirmedAt: '2026-11-12T00:00:00.000Z', delivered: '2026-11-14T00:00:00.000Z' });
  addOrder('refunded', { confirmedAt: '2026-11-12T00:00:00.000Z' });
  const o = (await get()).orders;
  assert.deepEqual(o.funnel, { placed: 4, paid: 3, delivered: 2 });
  assert.deepEqual(o.medianDeliveryHours, { template: 24, custom: 48 });
  assert.deepEqual(o.byStatus.find((s) => s.status === 'delivered'), { status: 'delivered', label: 'Delivered', count: 2 });
});

test('designs: grouped by design with packages; missing design is Unknown design', async () => {
  addOrder('delivered', { confirmedAt: '2026-11-12T00:00:00.000Z', pkg: 'Standard' });
  addOrder('delivered', { confirmedAt: '2026-11-12T00:00:00.000Z', pkg: 'Premium', amount: 50000 });
  addOrder('delivered', { confirmedAt: '2026-11-12T00:00:00.000Z', product: 99, pkg: 'Standard', amount: 1 });
  const { designs } = await get();
  assert.equal(designs[0].name, 'Rose');
  assert.equal(designs[0].paidOrders, 2);
  assert.equal(designs[0].revenueCentavos, 150000);
  assert.deepEqual(designs[0].packages.map((x) => x.name).sort(), ['Premium', 'Standard']);
  assert.equal(designs[1].name, 'Unknown design');
  assert.equal(designs[1].designId, null);
});

test('monthly: 12 months ending at the end month for short ranges', async () => {
  addOrder('delivered', { confirmedAt: '2026-03-05T00:00:00.000Z', amount: 700 });
  const { monthly } = await get();
  assert.equal(monthly.length, 12);
  assert.equal(monthly[0].month, '2025-12');
  assert.equal(monthly[11].month, '2026-11');
  assert.deepEqual(monthly.find((m) => m.month === '2026-03'), { month: '2026-03', revenueCentavos: 700, paidOrders: 1 });
});

test('inquiries: totals, custom, statuses, services, converted share, range bounded', async () => {
  inquiry('1', { status: 'Converted', service: 'Web' });
  inquiry('2', { desc: 'Custom package request: x', service: 'Design' });
  inquiry('3', { at: '2026-11-14T16:01:00.000Z' });
  const i = (await get()).inquiries;
  assert.equal(i.total, 2);
  assert.equal(i.custom, 1);
  assert.deepEqual(i.byStatus.map((s) => s.status).sort(), ['Converted', 'New']);
  assert.equal(i.byService.length, 2);
  assert.equal(i.convertedShare, 0.5);
});

test('permissions and range validation', async () => {
  assert.equal((await call(undefined, null)).status, 401);
  assert.equal((await call(undefined, 'ed')).status, 403);
  for (const [qs, msg] of [
    ['from=2026-11-15&to=2026-11-14', 'The start date must be before the end date.'],
    ['from=2025-01-01&to=2026-11-14', 'Choose a range of 366 days or less.'],
    ['from=nope&to=2026-11-14', 'Use dates like 2026-11-15.'],
    ['', 'Use dates like 2026-11-15.'],
  ]) {
    const r = await call(qs);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, msg);
  }
});

test('monthly: multi-month range gives whole calendar months at both ends', async () => {
  addOrder('delivered', { confirmedAt: '2026-10-02T00:00:00.000Z', amount: 100 }); // before range start, same month
  addOrder('delivered', { confirmedAt: '2026-10-15T00:00:00.000Z', amount: 200 });
  addOrder('delivered', { confirmedAt: '2026-11-05T00:00:00.000Z', amount: 400 });
  addOrder('delivered', { confirmedAt: '2026-11-25T00:00:00.000Z', amount: 800 }); // after range end, same month
  const d = await get('from=2026-10-10&to=2026-11-20');
  assert.deepEqual(d.monthly, [
    { month: '2026-10', revenueCentavos: 300, paidOrders: 2 },
    { month: '2026-11', revenueCentavos: 1200, paidOrders: 2 },
  ]);
  assert.equal(d.sales.revenueCentavos, 600); // sales stay range-bound
});

test('delivery median ignores legacy orders with no payment_confirmed event', async () => {
  addOrder('delivered', { confirmedAt: '2026-11-12T00:00:00.000Z', delivered: '2026-11-13T00:00:00.000Z' }); // 24h
  addOrder('delivered', { delivered: '2026-11-13T00:00:00.000Z' }); // legacy: paid-at falls back to delivered_at
  assert.equal((await get()).orders.medianDeliveryHours.template, 24);
});

// ---- CSV export ----
const exp = (kind, qs = 'from=2026-11-10&to=2026-11-14', as = 'adm') => onRequest({
  request: new Request(`https://shop.test/api/admin/reports/export/${kind}?` + qs, { headers: as ? { Authorization: 'Bearer ' + SIGN[as] } : {} }),
  env: { DB: db, PHOTOS: makeR2(), JWT_SECRET: SECRET },
});
const SIGN = {};
beforeEach(async () => { for (const a of ['adm', 'ed']) SIGN[a] = await signAdminToken(`${a}@jlc.test`, SECRET); });

test('export orders: headers, Manila times, 2-decimal amount, in-range rows only, paid at blank when unpaid', async () => {
  db.exec.prepare("INSERT INTO customers (id, email, name) VALUES (7, 'c1@x.com', 'Ana, \"Q\"')").run();
  const a = addOrder('payment_confirmed', { created: '2026-11-12 01:00:00', amount: 150000, confirmedAt: '2026-11-12T02:30:00.000Z' });
  db.exec.prepare('UPDATE orders SET customer_id = 7 WHERE id = ?').run(a);
  addOrder('pending_payment', { created: '2026-11-12 01:00:00' });
  addOrder('payment_confirmed', { created: '2026-11-14 16:01:00', confirmedAt: '2026-11-14T16:01:30.000Z' });
  const res = await exp('orders');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="orders-2026-11-10-to-2026-11-14.csv"');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual([...new Uint8Array(await res.clone().arrayBuffer()).slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  const lines = (await res.text()).split('\r\n');
  assert.equal(lines.length, 4); // header + 2 rows + trailing
  assert.ok(lines[0].startsWith('Reference,Created,Status,Design,Package,Package kind,Amount,Customer,Customer email,Paid at,Delivered at'));
  assert.equal(lines[1], 'JLC-1,2026-11-12 09:00,Payment Confirmed,Rose,Standard,template,1500.00,"Ana, ""Q""",c1@x.com,2026-11-12 10:30,');
  assert.match(lines[2], /,Rose,Standard,template,1000.00,,c2@x.com,,$/);
});

test('export payments and inquiries, with formula escaping in text cells', async () => {
  const o = addOrder('payment_confirmed');
  pay(o, 'confirmed', '2026-11-12T01:00:00.000Z', '2026-11-12T03:00:00.000Z', 5000);
  db.exec.prepare("UPDATE payments SET verified_by = 'adm@jlc.test'").run();
  db.exec.prepare('INSERT INTO inquiries (id, fullName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('i1', '=HYPERLINK("x")', 'a@b.c', '1', 'Web', 'hi', 'email', 'New', '2026-11-12T00:00:00.000Z');
  const p = (await (await exp('payments')).text()).split('\r\n');
  assert.match(p[1], /^JLC-1,2026-11-12 09:00,confirmed,manual_gcash,50\.00,,2026-11-12 11:00,adm@jlc\.test,/);
  const i = await (await exp('inquiries')).text();
  assert.ok(i.includes(`"'=HYPERLINK(""x"")"`));
});

test('export: more than 10,000 rows is a 413', async () => {
  db.exec.prepare(`WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM s WHERE n < 10001)
    INSERT INTO inquiries (id, fullName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt)
    SELECT 'q' || n, 'N', 'a@b.c', '1', 'Web', 'hi', 'email', 'New', '2026-11-12T00:00:00.000Z' FROM s`).run();
  const res = await exp('inquiries');
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: 'Too many rows — narrow the range.' });
});

test('export: Editor 403, no token 401, unknown kind 404, bad range 400', async () => {
  assert.equal((await exp('orders', undefined, 'ed')).status, 403);
  assert.equal((await exp('orders', undefined, null)).status, 401);
  assert.equal((await exp('nope')).status, 404);
  assert.equal((await exp('orders', 'from=2026-11-14&to=2026-11-10')).status, 400);
});

test('export: a malformed timestamp is exported raw instead of failing the whole file', async () => {
  inquiry('bad', { at: '2026-11-12Tgarbage' });
  const res = await exp('inquiries');
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('2026-11-12Tgarbage'));
});
