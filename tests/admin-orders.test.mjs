// Admin orders API, role permissions and payment settings, on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: orders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { onRequest: paymentSettings } = await bundle('functions/api/admin/payment-settings.ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const { can } = await bundle('server/permissions.ts');

const SECRET = 'jwt-secret';
const ADMINS = { boss: 'Super Admin', adm: 'Administrator', ed: 'Editor' };
let db, r2, background;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  background = [];
  for (const [name, role] of Object.entries(ADMINS)) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation')`);
});

const q = (sql) => db.exec.prepare(sql).all();
let n = 0;
// Order <status> with its pending invitation and customer; returns the order id
const addOrder = (status, { email = `c${++n}@example.com`, name = 'Maria Cruz', partner1 = 'Maria' } = {}) => {
  const i = db.exec.prepare(`INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
    VALUES (1, ?, '{"name":"Blush"}', ?, '["inv/x/0.png"]', 'pending', '2027-06-12', ?)`)
    .run(`s-${n}-${Math.random()}`, JSON.stringify({ partner1, partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } }), `h${Math.random()}`);
  const c = db.exec.prepare('INSERT INTO customers (email, name, phone) VALUES (?, ?, ?)').run(email, name, '0917');
  const o = db.exec.prepare(`INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, customer_id, provider, payment_deadline)
    VALUES (?, ?, 99900, ?, ?, ?, 'manual_gcash', '2099-01-01T00:00:00.000Z')`)
    .run(Number(i.lastInsertRowid), email, status, `JLC-${String(n).padStart(6, 'A')}`, Number(c.lastInsertRowid));
  return Number(o.lastInsertRowid);
};
// Submitted receipt for order <id>; returns the payment id
const addPayment = (orderId) => {
  const key = `receipts/${orderId}/1.png`;
  r2.map.set(key, { body: 'png-bytes', bytes: new Uint8Array([1, 2]), httpMetadata: { contentType: 'image/png' } });
  return Number(db.exec.prepare(`INSERT INTO payments (order_id, provider, amount_centavos, status, receipt_key, submitted_at)
    VALUES (?, 'manual_gcash', 99900, 'submitted', ?, 't')`).run(orderId, key).lastInsertRowid);
};

const call = async (fn, path, { as, body } = {}) => {
  const headers = as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {};
  return fn({ request: new Request('https://shop.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers }),
    env: { DB: db, PHOTOS: r2, JWT_SECRET: SECRET }, waitUntil(p) { background.push(p); } });
};
const api = (path, opts) => call(orders, '/api/admin/orders' + path, opts);
const act = (id, as, body) => api(`/${id}`, { as, body });

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const dataUrl = (type, buf) => `data:image/${type};base64,${buf.toString('base64')}`;

test('can(): role matrix', () => {
  assert.equal(can('Super Admin', 'settings.payment'), true);
  assert.equal(can('Administrator', 'settings.payment'), false);
  assert.equal(can('Administrator', 'orders.refund'), true);
  assert.equal(can('Editor', 'orders.work'), true);
  assert.equal(can('Editor', 'orders.contact'), false);
  assert.equal(can('constructor', 'orders.view'), false);
});

test('no token → 401; unknown order → 404', async () => {
  assert.equal((await api('')).status, 401);
  assert.equal((await call(paymentSettings, '/api/admin/payment-settings')).status, 401);
  assert.equal((await api('/999', { as: 'adm' })).status, 404);
  assert.equal((await act(999, 'adm', { action: 'note', body: 'x' })).status, 404);
});

test('list: counts by status, filters, search, contact only with orders.contact', async () => {
  addOrder('pending_payment', { email: 'ana@example.com' });
  addOrder('payment_verification');
  addOrder('payment_verification', { name: 'Zed Lopez', partner1: 'Zelda' });
  const res = await api('', { as: 'adm' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.counts.payment_verification, 2);
  assert.equal(data.counts.pending_payment, 1);
  assert.equal(data.counts.delivered, 0);
  assert.deepEqual([data.page, data.pages, data.orders.length], [1, 1, 3]);
  const first = data.orders.find((o) => o.status === 'pending_payment');
  assert.equal(first.email, 'ana@example.com');
  assert.equal(first.title, 'Maria & Juan');
  assert.equal(first.designName, 'Classic Elegance');
  assert.equal(first.statusLabel, 'Pending Payment');
  assert.equal(first.awaitingReceipt, true);

  assert.equal((await (await api('?status=payment_verification', { as: 'adm' })).json()).orders.length, 2);
  assert.equal((await (await api('?q=zelda', { as: 'adm' })).json()).orders.length, 1);
  assert.equal((await (await api('?q=ana@example', { as: 'adm' })).json()).orders.length, 1);
  assert.equal((await (await api('?assigned=none', { as: 'adm' })).json()).orders.length, 3);
  assert.equal((await (await api('?assigned=me', { as: 'adm' })).json()).orders.length, 0);

  const ed = await (await api('', { as: 'ed' })).json();
  assert.equal(ed.orders.length, 3);
  assert.ok(ed.orders.every((o) => !('email' in o)));
  assert.equal((await (await api('?q=ana@example', { as: 'ed' })).json()).orders.length, 0, 'Editors cannot search by email');
});

test('detail: Editor gets no contact fields or receipt URLs; Administrator does', async () => {
  const id = addOrder('payment_verification', { email: 'ana@example.com' });
  addPayment(id);
  const ed = await (await api(`/${id}`, { as: 'ed' })).json();
  assert.ok(!JSON.stringify(ed).includes('ana@example.com'));
  assert.ok(!JSON.stringify(ed).includes('0917'));
  assert.equal(ed.payments[0].receiptUrl, undefined);
  assert.deepEqual(ed.allowedNext, []);
  assert.equal(ed.invitation.layoutKey, 'classic');
  assert.deepEqual(ed.invitation.photos, ['inv/x/0.png']);

  const adm = await (await api(`/${id}`, { as: 'adm' })).json();
  assert.equal(adm.customer.email, 'ana@example.com');
  assert.equal(adm.customer.phone, '0917');
  assert.equal(adm.payments[0].receiptUrl, `/api/admin/orders/${id}/receipts/${adm.payments[0].id}`);
  assert.deepEqual(adm.allowedNext, ['pending_payment', 'payment_confirmed', 'cancelled']);
});

test('Editor → 403 on receipt, approve, reject, refund, assign, cancel, resend, payment-settings', async () => {
  const id = addOrder('payment_verification');
  const pid = addPayment(id);
  assert.equal((await api(`/${id}/receipts/${pid}`, { as: 'ed' })).status, 403);
  for (const body of [{ action: 'approve', paymentId: pid }, { action: 'reject', paymentId: pid, reason: 'blurry' }, { action: 'refund', note: 'x' },
    { action: 'assign', email: 'ed@jlc.test' }, { action: 'status', to: 'cancelled' }, { action: 'resend' }]) {
    assert.equal((await act(id, 'ed', body)).status, 403, body.action);
  }
  assert.equal((await call(paymentSettings, '/api/admin/payment-settings', { as: 'ed' })).status, 403);
  assert.equal((await call(paymentSettings, '/api/admin/payment-settings', { as: 'adm' })).status, 403);
  assert.equal(q("SELECT status FROM orders")[0].status, 'payment_verification');
});

test('receipt: streams the image privately; a payment of another order → 404', async () => {
  const id = addOrder('payment_verification');
  const pid = addPayment(id);
  const other = addOrder('payment_verification');
  const res = await api(`/${id}/receipts/${pid}`, { as: 'adm' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(await res.text(), 'png-bytes');
  assert.equal((await api(`/${other}/receipts/${pid}`, { as: 'adm' })).status, 404);
});

test('approve → for_review, audit row, confirmed email queued', async () => {
  const id = addOrder('payment_verification');
  const pid = addPayment(id);
  const other = addOrder('payment_verification');
  assert.equal((await act(other, 'adm', { action: 'approve', paymentId: pid })).status, 404, 'payment of another order');
  const res = await act(id, 'adm', { action: 'approve', paymentId: pid, adminReference: 'GC123' });
  assert.equal(res.status, 200);
  assert.equal(q(`SELECT status FROM orders WHERE id = ${id}`)[0].status, 'for_review');
  assert.equal(q(`SELECT admin_reference FROM payments WHERE id = ${pid}`)[0].admin_reference, 'GC123');
  const [log] = q("SELECT * FROM audit_logs WHERE log_type = 'order'");
  assert.match(log.message, /adm@jlc\.test.*approve.*JLC-/);
  assert.equal(background.length, 1);
  assert.equal((await act(id, 'adm', { action: 'approve', paymentId: pid })).status, 409, 'already reviewed');
});

test('reject: reason required; with reason → pending_payment', async () => {
  const id = addOrder('payment_verification');
  const pid = addPayment(id);
  assert.equal((await act(id, 'adm', { action: 'reject', paymentId: pid })).status, 400);
  assert.equal((await act(id, 'adm', { action: 'reject', paymentId: pid, reason: '  ' })).status, 400);
  assert.equal((await act(id, 'adm', { action: 'reject', paymentId: pid, reason: 'Amount does not match' })).status, 200);
  assert.equal(q(`SELECT status FROM orders WHERE id = ${id}`)[0].status, 'pending_payment');
  assert.equal(q("SELECT * FROM audit_logs WHERE log_type = 'order'").length, 1);
});

test('status: work moves allowed, non-allowed next → 400, unknown target → 400', async () => {
  const id = addOrder('for_review');
  assert.equal((await act(id, 'ed', { action: 'status', to: 'payment_confirmed' })).status, 400);
  assert.equal((await act(id, 'ed', { action: 'status', to: 'pending_payment' })).status, 400);
  assert.equal((await act(id, 'ed', { action: 'status', to: 'bogus' })).status, 400);
  assert.equal((await act(id, 'ed', { action: 'status', to: 'revision_requested', note: 'Fix the date' })).status, 200);
  assert.equal(q(`SELECT status FROM orders WHERE id = ${id}`)[0].status, 'revision_requested');
  assert.equal((await act(id, 'ed', { action: 'status', to: 'completed' })).status, 400, 'revision_requested cannot go to completed');
  const p = addOrder('pending_payment');
  assert.equal((await act(p, 'adm', { action: 'status', to: 'cancelled' })).status, 200);
  assert.equal(q(`SELECT status FROM orders WHERE id = ${p}`)[0].status, 'cancelled');
});

test('deliver → invitation live, delivered, emailed reflects SMTP', async () => {
  const id = addOrder('for_review');
  const res = await act(id, 'ed', { action: 'deliver' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, emailed: false });
  assert.equal(q(`SELECT status FROM orders WHERE id = ${id}`)[0].status, 'delivered');
  assert.equal(q(`SELECT i.status FROM invitations i JOIN orders o ON o.product_id = i.id WHERE o.id = ${id}`)[0].status, 'live');
  assert.equal((await act(id, 'ed', { action: 'deliver' })).status, 409);
});

test('refund, assign, note', async () => {
  const id = addOrder('delivered');
  assert.equal((await act(id, 'adm', { action: 'refund', note: 'Customer asked' })).status, 200);
  assert.equal(q(`SELECT status FROM orders WHERE id = ${id}`)[0].status, 'refunded');

  const w = addOrder('for_review');
  assert.equal((await act(w, 'adm', { action: 'assign', email: 'nobody@jlc.test' })).status, 400);
  assert.equal((await act(w, 'adm', { action: 'assign', email: 'ed@jlc.test' })).status, 200);
  assert.equal(q(`SELECT assigned_to FROM orders WHERE id = ${w}`)[0].assigned_to, 'ed@jlc.test');
  assert.equal((await (await api('?assigned=me', { as: 'ed' })).json()).orders.length, 1);
  assert.equal((await act(w, 'adm', { action: 'assign', email: null })).status, 200);
  assert.equal(q(`SELECT assigned_to FROM orders WHERE id = ${w}`)[0].assigned_to, null);

  assert.equal((await act(w, 'ed', { action: 'note', body: 'x'.repeat(1001) })).status, 400);
  assert.equal((await act(w, 'ed', { action: 'note', body: 'Started layout' })).status, 200);
  const notes = q(`SELECT kind, note, visible FROM order_events WHERE order_id = ${w} AND kind = 'note'`);
  assert.deepEqual(notes.map((e) => ({ ...e })), [{ kind: 'note', note: 'Started layout', visible: 0 }]);
  assert.equal(q("SELECT * FROM audit_logs WHERE log_type = 'order'").length, 4, 'refund, assign, unassign, note');
  assert.equal((await act(w, 'adm', { action: 'bogus' })).status, 400);
});

test('payment-settings: GET, save fields, SVG-as-PNG → 400, PNG → qr_key set and old object deleted', async () => {
  db.exec.exec("UPDATE payment_settings SET qr_key = 'settings/old.png'");
  r2.map.set('settings/old.png', { body: 'old', bytes: new Uint8Array([1]), httpMetadata: { contentType: 'image/png' } });
  const ps = (body) => call(paymentSettings, '/api/admin/payment-settings', { as: 'boss', body });

  const got = await (await call(paymentSettings, '/api/admin/payment-settings', { as: 'boss' })).json();
  assert.equal(got.deadlineHours, 48);

  const svg = dataUrl('png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  assert.equal((await ps({ qrImage: svg })).status, 400);
  assert.equal(q('SELECT qr_key FROM payment_settings')[0].qr_key, 'settings/old.png');
  assert.equal((await ps({ deadlineHours: 0 })).status, 400);

  const res = await ps({ gcashAccountName: 'JLC Solutions', gcashNumber: '09171234567', instructions: 'Send exact amount.', deadlineHours: 24, qrImage: dataUrl('png', PNG) });
  assert.equal(res.status, 200);
  const [row] = q('SELECT * FROM payment_settings');
  assert.match(row.qr_key, /^settings\/gcash-qr-\d+\.png$/);
  assert.deepEqual([row.gcash_account_name, row.gcash_number, row.instructions, row.deadline_hours], ['JLC Solutions', '09171234567', 'Send exact amount.', 24]);
  assert.ok(r2.map.has(row.qr_key));
  assert.equal(r2.map.get(row.qr_key).httpMetadata.contentType, 'image/png');
  assert.equal(r2.map.has('settings/old.png'), false);

  // Text-only save keeps the QR
  assert.equal((await ps({ instructions: 'New text' })).status, 200);
  assert.equal(q('SELECT qr_key FROM payment_settings')[0].qr_key, row.qr_key);
});
