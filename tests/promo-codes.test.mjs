import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { applyPromo, validatePromoInput, normalizeCode, promoLabel } = await bundle('shared/promo.ts');

const base = { code: 'X', discount_type: 'percent', discount_value: 10, min_purchase_centavos: 0, starts_at: null, expires_at: null, max_uses: null, active: 1 };
const now = new Date('2026-11-18T00:00:00Z');
const apply = (o, price = 99900, used = 0) => applyPromo({ ...base, ...o }, price, now, used);

test('normalizeCode trims and uppercases', () => assert.equal(normalizeCode('  welcome-10 '), 'WELCOME-10'));

test('applyPromo refusals, each with its message', () => {
  assert.deepEqual(apply({ active: 0 }), { ok: false, reason: 'inactive', error: 'This promo code is not active.' });
  assert.equal(apply({ starts_at: '2026-12-01T00:00:00Z' }).error, 'This promo code is not active yet.');
  assert.equal(apply({ expires_at: '2026-11-17T00:00:00Z' }).error, 'This promo code has expired.');
  assert.equal(apply({ max_uses: 2 }, 99900, 2).error, 'This promo code has reached its limit.');
  assert.equal(apply({ min_purchase_centavos: 150000 }).error, 'This promo code needs a minimum purchase of ₱1,500.');
  assert.equal(apply({ max_uses: 2 }, 99900, 1).ok, true);
});

test('percent rounds to the nearest centavo; fixed is capped; total never below 100 centavos', () => {
  assert.deepEqual(apply({}, 99999), { ok: true, discountCentavos: 10000, totalCentavos: 89999 }); // 9999.9 -> 10000
  assert.equal(apply({ discount_value: 33 }, 1001).discountCentavos, 330); // 330.33
  assert.deepEqual(apply({ discount_type: 'fixed', discount_value: 20000 }), { ok: true, discountCentavos: 20000, totalCentavos: 79900 });
  assert.deepEqual(apply({ discount_value: 100 }), { ok: true, discountCentavos: 99800, totalCentavos: 100 });
  assert.deepEqual(apply({ discount_type: 'fixed', discount_value: 500000 }), { ok: true, discountCentavos: 99800, totalCentavos: 100 });
  assert.deepEqual(apply({ discount_value: 50 }, 100), { ok: true, discountCentavos: 0, totalCentavos: 100 });
});

test('labels', () => {
  assert.equal(promoLabel('percent', 10), '10% off');
  assert.equal(promoLabel('fixed', 20000), '₱200 off');
});

test('validatePromoInput', () => {
  const ok = { code: ' save-10 ', discountType: 'percent', discountValue: 10 };
  const r = validatePromoInput(ok);
  assert.equal(r.ok, true);
  assert.deepEqual([r.value.code, r.value.minPurchaseCentavos, r.value.maxUses, r.value.startsAt], ['SAVE-10', 0, null, null]);
  const bad = (o) => assert.equal(validatePromoInput({ ...ok, ...o }).ok, false, JSON.stringify(o));
  for (const o of [{ code: 'ab' }, { code: 'a'.repeat(31) }, { code: 'a b' }, { description: 'x'.repeat(121) }, { discountType: 'bogus' },
    { discountValue: 0 }, { discountValue: 101 }, { discountValue: 1.5 }, { discountType: 'fixed', discountValue: 99 }, { minPurchaseCentavos: -1 },
    { startsAt: 'nope' }, { startsAt: '2026-12-01', expiresAt: '2026-11-01' }, { startsAt: '2026-12-01', expiresAt: '2026-12-01' }, { maxUses: 0 }, { maxUses: 1.5 }]) bad(o);
  assert.equal(validatePromoInput({ ...ok, discountType: 'fixed', discountValue: 100, maxUses: 1, startsAt: '2026-11-01', expiresAt: '2026-12-01' }).ok, true);
});

// ---- server side ----
import { beforeEach } from 'node:test';
import { makeD1, makeR2 } from './helpers/d1.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: promosApi } = await bundle('functions/api/admin/promos/[[path]].ts');
const { onRequest: ordersApi } = await bundle('functions/api/orders/[[path]].ts');
const { onRequest: adminOrders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { dashboardData } = await bundle('functions/api/admin/dashboard.ts');
const { signAdminToken } = await bundle('server/crypto.ts');

globalThis.fetch = async (url) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true });
  throw new Error('Unexpected fetch ' + url);
};
const SECRET = 'j';
let db, r2, bg;
beforeEach(() => {
  db = makeD1(); r2 = makeR2(); bg = []; globalThis.SMTP_SENT = []; globalThis.SMTP_FAIL = false;
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation');
    INSERT INTO smtp_settings (id, host, port, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, 'JLC', 'co@x.com', 1);
    UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '09171234567', qr_key = 'settings/qr.png'`);
  for (const [email, role] of [['adm@jlc.test', 'Administrator'], ['ed@jlc.test', 'Editor']])
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(email, role, role);
});
const env = () => ({ DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 's', JWT_SECRET: SECRET });
const addPromo = (o = {}) => {
  const p = { code: 'SAVE10', discount_type: 'percent', discount_value: 10, min_purchase_centavos: 0, starts_at: null, expires_at: null, max_uses: null, active: 1, ...o };
  db.exec.prepare('INSERT INTO promo_codes (code, discount_type, discount_value, min_purchase_centavos, starts_at, expires_at, max_uses, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.code, p.discount_type, p.discount_value, p.min_purchase_centavos, p.starts_at, p.expires_at, p.max_uses, p.active);
};
const checkout = async (extra = {}) => {
  const res = await invitations({
    request: new Request('https://shop.test/api/invitations/checkout', { method: 'POST', body: JSON.stringify({
      designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'bride@example.com', name: 'Maria Cruz', phone: '0917', termsAccepted: true,
      turnstileToken: 'x', details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } }, ...extra }) }),
    env: env(), waitUntil(p) { bg.push(p); },
  });
  await Promise.all(bg); bg = [];
  return res;
};
const orders = () => db.exec.prepare('SELECT * FROM orders').all();
const count = (t) => db.exec.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
const check = (body, ip = '1.1.1.1') => invitations({
  request: new Request('https://shop.test/api/invitations/promo', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ designSlug: 'classic-elegance', ...body }) }),
  env: env(), waitUntil() {},
});

test('public check returns the server-computed amounts and a label', async () => {
  addPromo();
  const res = await check({ code: ' save10 ' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { code: 'SAVE10', discountCentavos: 9990, totalCentavos: 89910, subtotalCentavos: 99900, label: '10% off' });
  const bad = await check({ code: 'NOPE' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'We could not find that promo code.');
});

test('public check is limited to 20 per IP per hour', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await check({ code: 'NOPE' })).status, 400);
  assert.equal((await check({ code: 'NOPE' })).status, 429);
  assert.equal((await check({ code: 'NOPE' }, '2.2.2.2')).status, 400);
});

test('checkout stores the code and discount and charges the server total, ignoring client amounts', async () => {
  addPromo({ discount_type: 'fixed', discount_value: 20000 });
  const res = await checkout({ promoCode: 'save10', amountCentavos: 1, totalCentavos: 1, discountCentavos: 99000, priceCentavos: 1 });
  assert.equal(res.status, 200);
  const [o] = orders();
  assert.deepEqual([o.promo_code, o.discount_centavos, o.amount_centavos], ['SAVE10', 20000, 79900]);
  assert.equal(count('order_events'), 1);
});

test('without a promo code the order is unchanged', async () => {
  assert.equal((await checkout()).status, 200);
  const [o] = orders();
  assert.deepEqual([o.promo_code, o.discount_centavos, o.amount_centavos], [null, 0, 99900]);
  assert.equal(count('order_events'), 1);
});

test('refused at checkout without calling the check endpoint: nothing is created', async () => {
  const cases = [
    [{ active: 0 }, 'This promo code is not active.'],
    [{ starts_at: '2999-01-01T00:00:00.000Z' }, 'This promo code is not active yet.'],
    [{ expires_at: '2020-01-01T00:00:00.000Z' }, 'This promo code has expired.'],
    [{ min_purchase_centavos: 500000 }, 'This promo code needs a minimum purchase of ₱5,000.'],
    [{ max_uses: 1 }, 'This promo code has reached its limit.'],
  ];
  for (const [o, msg] of cases) {
    db.exec.exec('DELETE FROM promo_codes; DELETE FROM orders; DELETE FROM invitations');
    addPromo(o);
    if (o.max_uses) db.exec.exec("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash) VALUES (900, 1, 'old', '{}', '{}', '[]', 'pending', '2027-01-01', 'h'); INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, promo_code) VALUES (900, 'a@b.c', 1, 'pending_payment', 'JLC-OLD', 'manual_gcash', 'SAVE10')");
    const before = [count('orders'), count('invitations')];
    const res = await checkout({ promoCode: 'SAVE10' });
    assert.equal(res.status, 400, msg);
    assert.equal((await res.json()).error, msg);
    assert.deepEqual([count('orders'), count('invitations')], before);
  }
  assert.equal((await checkout({ promoCode: 'GHOST' })).status, 400);
});

test('a cancelled order does not count against the limit', async () => {
  addPromo({ max_uses: 1 });
  assert.equal((await checkout({ promoCode: 'SAVE10' })).status, 200);
  assert.equal((await checkout({ promoCode: 'SAVE10' })).status, 400);
  db.exec.exec("UPDATE orders SET status = 'cancelled'");
  assert.equal((await checkout({ promoCode: 'SAVE10' })).status, 200);
});

test('two parallel checkouts with max_uses 1 create exactly one order and leave no stray invitation', async () => {
  addPromo({ max_uses: 1 });
  const results = await Promise.all([checkout({ promoCode: 'SAVE10' }), checkout({ promoCode: 'SAVE10' })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await results.find((r) => r.status === 409).json()).error, 'This promo code has reached its limit.');
  assert.deepEqual([count('orders'), count('invitations'), count('order_events')], [1, 1, 1]);
});

test('alert and customer emails show the promo lines; order views return the fields', async () => {
  addPromo();
  const { reference, trackingToken } = await (await checkout({ promoCode: 'SAVE10' })).json();
  const mails = globalThis.SMTP_SENT.filter((t) => t.startsWith('Message-ID')).map((t) => t.replace(/=\r\n/g, ''));
  assert.equal(mails.length, 2);
  for (const m of mails) {
    assert.match(m, /Promo code[\s\S]*SAVE10/);
    assert.match(m, /Discount[\s\S]*PHP 99\.90/);
  }
  assert.match(mails.find((m) => m.includes('New order')), /Subtotal[\s\S]*PHP 999\.00/);
  const view = await (await ordersApi({ request: new Request(`https://shop.test/api/orders/${reference}`, { headers: { 'X-Order-Token': trackingToken } }), env: env(), waitUntil() {} })).json();
  assert.deepEqual([view.promoCode, view.discountCentavos, view.amountCentavos, view.subtotalCentavos], ['SAVE10', 9990, 89910, 99900]);
  const token = await signAdminToken('adm@jlc.test', SECRET);
  const admin = await (await adminOrders({ request: new Request('https://shop.test/api/admin/orders/1', { headers: { Authorization: 'Bearer ' + token } }), env: env(), params: {}, waitUntil() {} })).json();
  assert.deepEqual([admin.order.promoCode, admin.order.discountCentavos], ['SAVE10', 9990]);
});

const adminCall = async (body, method = 'POST', email = 'adm@jlc.test') => {
  const res = await promosApi({ request: new Request('https://shop.test/api/admin/promos', { method, headers: { Authorization: 'Bearer ' + await signAdminToken(email, SECRET) }, body: method === 'POST' ? JSON.stringify(body) : undefined }), env: env(), waitUntil() {} });
  return [res.status, await res.json()];
};

test('admin CRUD: create, duplicate, update, toggle, delete, audit rows, role gate', async () => {
  const input = { action: 'create', code: 'launch-20', discountType: 'percent', discountValue: 20, maxUses: 5 };
  const [s1, created] = await adminCall(input);
  assert.equal(s1, 200);
  assert.equal((await adminCall(input))[0], 409);
  assert.equal((await adminCall({ ...input, code: 'x' }))[0], 400);
  assert.equal((await adminCall({ ...input, action: 'update', id: created.id, discountValue: 25 }))[0], 200);
  assert.equal((await adminCall({ action: 'toggle', id: created.id, active: false }))[0], 200);
  const [, list] = await adminCall(null, 'GET');
  assert.deepEqual([list.promos[0].code, list.promos[0].discountValue, list.promos[0].active, list.promos[0].uses], ['LAUNCH-20', 25, false, 0]);
  assert.equal((await adminCall({ action: 'delete', id: created.id }))[0], 200);
  assert.equal((await adminCall({ action: 'delete', id: created.id }))[0], 404);
  assert.equal(db.exec.prepare("SELECT COUNT(*) n FROM audit_logs WHERE log_type = 'promo'").get().n, 4);
  assert.equal((await adminCall(null, 'GET', 'ed@jlc.test'))[0], 403);
});

test('admin: stats count paid orders, and a used code cannot be renamed or deleted', async () => {
  addPromo();
  await checkout({ promoCode: 'SAVE10' }); // pending: a use, not redeemed
  await checkout({ promoCode: 'SAVE10' });
  db.exec.exec("UPDATE orders SET status = 'payment_confirmed' WHERE id = 1");
  const [, { promos: [p] }] = await adminCall(null, 'GET');
  assert.deepEqual([p.uses, p.redeemed, p.discountGivenCentavos, p.revenueCentavos], [2, 1, 9990, 89910]);
  const body = { action: 'update', id: p.id, code: 'SAVE10', discountType: 'percent', discountValue: 10 };
  assert.equal((await adminCall({ ...body, code: 'RENAMED' }))[0], 409);
  assert.equal((await adminCall({ ...body, description: 'ok' }))[0], 200);
  const [s, e] = await adminCall({ action: 'delete', id: p.id });
  assert.deepEqual([s, e.error], [409, 'This code has been used; deactivate it instead.']);
});

test('dashboard promotions: paid orders with a code in the range, money roles only', async () => {
  addPromo();
  await checkout({ promoCode: 'SAVE10' });
  await checkout({ promoCode: 'SAVE10' });
  await checkout();
  db.exec.exec("UPDATE orders SET status = 'payment_confirmed' WHERE id IN (1, 3)");
  const now = new Date(Date.now() + 60_000);
  assert.deepEqual((await dashboardData(db, 'Administrator', 'adm@jlc.test', now)).promotions, { redeemed: 1, discountCentavos: 9990 });
  assert.equal((await dashboardData(db, 'Editor', 'ed@jlc.test', now)).promotions, undefined);
});
