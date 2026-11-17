// Journey tests: real Functions chained on ONE db and ONE r2, asserting state after every step.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: orders } = await bundle('functions/api/orders/[[path]].ts');
const { onRequest: adminOrders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { onRequest: adminInvitations } = await bundle('functions/api/admin/invitations/[[path]].ts');
const { onRequest: adminInquiries } = await bundle('functions/api/admin/inquiries/[[path]].ts');
const { onRequest: adminUsers } = await bundle('functions/api/admin/users/[[path]].ts');
const { onRequest: route } = await bundle('functions/api/[[route]].ts');
const { onRequestGet: guestPage } = await bundle('functions/i/[slug].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: new URLSearchParams(init.body).get('response') === 'good-token' });
  throw new Error('Unexpected fetch ' + url);
};

const SECRET = 'jwt-secret';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const SHELL = '<!doctype html><html><head><title>Wedding invitation</title><!--og-tags--></head><body></body></html>';
const ASSETS = { fetch: async () => new Response(SHELL, { headers: { 'Content-Type': 'text/html' } }) };
const pk = (key, name, priceCentavos, kind) => ({ key, name, priceCentavos, inclusions: [], kind });
let db, r2, background;

beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  background = [];
  globalThis.SMTP_SENT = [];
  globalThis.SMTP_FAIL = false;
  db.exec.prepare(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type, packages)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation', ?)`)
    .run(JSON.stringify([pk('standard', 'Standard', 99900, 'template'), pk('bespoke', 'Bespoke', 500000, 'custom')]));
  db.exec.exec("UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '09171234567', qr_key = 'settings/qr.png'");
  const admin = db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')");
  admin.run('boss@jlc.test', 'boss', 'Super Admin');
  admin.run('adm@jlc.test', 'adm', 'Administrator');
});

const env = () => ({ DB: db, PHOTOS: r2, ASSETS, TURNSTILE_SECRET_KEY: 'x', JWT_SECRET: SECRET });
const ctx = (request) => ({ request, env: env(), params: {}, waitUntil(p) { background.push(p); } });
const settle = () => Promise.all(background.splice(0));
const q = (sql) => db.exec.prepare(sql).all();
const smtpOn = () => db.exec.exec("INSERT OR REPLACE INTO smtp_settings (id, host, port, username, password, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, '', '', 'JLC', 'co@x.com', 1)");
const mails = () => globalThis.SMTP_SENT.filter((t) => t.startsWith('Message-ID')).map((t) => t.replace(/=\r\n/g, ''));
const mailTo = (subject) => mails().filter((m) => m.includes(`Subject: ${subject}`));
const bearer = async (email) => ({ Authorization: 'Bearer ' + await signAdminToken(email, SECRET) });
const send = (fn, path, { body, headers } = {}) => fn(ctx(new Request('https://shop.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers })));
const adminCall = async (fn, base, path, body, email = 'boss@jlc.test') => send(fn, base + path, { body, headers: await bearer(email) });
const status = (id) => q(`SELECT status FROM orders WHERE id = ${id}`)[0].status;
const ok = async (res) => { assert.equal(res.status, 200, await res.clone().text()); return res.json(); };

const place = async (extra = {}) => {
  const body = await ok(await send(invitations, '/api/invitations/checkout', { body: {
    designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'bride@example.com', name: 'Maria Cruz', termsAccepted: true, turnstileToken: 'good-token',
    details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } }, ...extra } }));
  await settle();
  return { ...body, id: q(`SELECT id FROM orders WHERE reference = '${body.reference}'`)[0].id };
};
const customer = (o, path = '', body) => send(orders, `/api/orders/${o.reference}${path}`, { body, headers: { 'X-Order-Token': o.trackingToken } });
const orderAdmin = (o, body) => adminCall(adminOrders, '/api/admin/orders', `/${o.id}`, body);
const uploadReceipt = async (o) => {
  await ok(await customer(o, '/receipt', { image: `data:image/png;base64,${PNG.toString('base64')}` }));
  await settle();
  assert.equal(status(o.id), 'payment_verification');
  return q(`SELECT id FROM payments WHERE order_id = ${o.id}`)[0].id;
};

test('journey: template order, live invitation, guest RSVP, delivered, with emails', async () => {
  smtpOn();
  const o = await place();
  assert.equal(status(o.id), 'pending_payment');
  assert.equal(q('SELECT status FROM invitations')[0].status, 'pending');
  assert.equal(mailTo('Your order is placed').length, 1);

  const paymentId = await uploadReceipt(o);
  assert.equal(q('SELECT status FROM payments')[0].status, 'submitted');

  await ok(await orderAdmin(o, { action: 'approve', paymentId }));
  await settle();
  assert.equal(status(o.id), 'for_review');
  assert.equal(q('SELECT status FROM payments')[0].status, 'confirmed');
  const confirmed = mailTo('Your payment is confirmed');
  assert.equal(confirmed.length, 1);
  assert.ok(confirmed[0].includes(`https://shop.test/order/${o.reference}`));
  assert.equal(mailTo('Your invitation is live').length, 0);

  await ok(await orderAdmin(o, { action: 'deliver' }));
  await settle();
  assert.equal(status(o.id), 'delivered');
  const { id: invId, slug, status: invStatus } = q('SELECT id, slug, status FROM invitations')[0];
  assert.equal(invStatus, 'live');
  const delivered = mailTo('Your invitation is live');
  assert.equal(delivered.length, 1);
  assert.ok(delivered[0].includes('To: <bride@example.com>'));
  assert.ok(delivered[0].includes(`https://shop.test/i/${slug}`));
  assert.match(delivered[0], /https:\/\/shop\.test\/manage#[A-Za-z0-9_-]{43}/);

  // The guest sees it
  assert.equal((await ok(await send(invitations, `/api/invitations/i/${slug}`))).state, 'live');
  const page = await guestPage({ ...ctx(new Request(`https://shop.test/i/${slug}`)), params: { slug } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<meta property="og:title" content="Maria &amp; Juan — June 12, 2027">/);

  // The guest RSVPs and the admin sees it
  await ok(await send(invitations, `/api/invitations/i/${slug}/rsvp`, { body: { guestName: 'Ana', attending: true, partySize: 2, message: 'See you!', turnstileToken: 'good-token' } }));
  assert.equal(q('SELECT guest_name FROM rsvps').length, 1);
  const listed = await ok(await adminCall(adminInvitations, '/api/admin/invitations', `/invitations/${invId}/rsvps`));
  assert.deepEqual(listed.rsvps.map((r) => [r.guestName, r.attending, r.partySize, r.message]), [['Ana', true, 2, 'See you!']]);

  // The customer sees delivered
  assert.equal((await ok(await customer(o))).status, 'delivered');
});

test('journey: custom order, proof, changes, proof, approve, deliver', async () => {
  const o = await place({ packageKey: 'bespoke', designerNotes: 'Gold foil please' });
  assert.deepEqual({ ...q('SELECT package_kind, designer_notes, status FROM orders')[0] }, { package_kind: 'custom', designer_notes: 'Gold foil please', status: 'pending_payment' });

  const paymentId = await uploadReceipt(o);
  await ok(await orderAdmin(o, { action: 'approve', paymentId }));
  assert.equal(status(o.id), 'in_production');
  assert.equal((await orderAdmin(o, { action: 'deliver' })).status, 409, 'deliver before approval');
  assert.equal(status(o.id), 'in_production');

  await ok(await orderAdmin(o, { action: 'proof', url: 'https://example.com/p1' }));
  assert.equal(status(o.id), 'for_review');
  const p1 = q('SELECT id, round FROM order_proofs')[0];
  assert.equal(p1.round, 1);

  await ok(await customer(o, '/review', { decision: 'changes', note: 'Bigger names', proofId: p1.id }));
  assert.equal(status(o.id), 'revision_requested');
  assert.equal((await orderAdmin(o, { action: 'deliver' })).status, 409);

  await ok(await orderAdmin(o, { action: 'proof', url: 'https://example.com/p2' }));
  assert.equal(status(o.id), 'for_review');
  const p2 = q('SELECT id, round FROM order_proofs ORDER BY id DESC')[0];
  assert.equal(p2.round, 2);

  await ok(await customer(o, '/review', { decision: 'approve', proofId: p2.id }));
  assert.equal(status(o.id), 'completed');
  assert.equal((await orderAdmin(o, { action: 'deliver' })).status, 200);
  assert.equal(status(o.id), 'delivered');
  assert.equal((await ok(await customer(o))).status, 'delivered');
  assert.equal(q('SELECT status FROM invitations')[0].status, 'live');
});

test('journey: inquiry, reply, order link, Converted, two emails logged', async () => {
  const res = await send(route, '/api/inquiry', { body: { fullName: 'Eve', email: 'Eve@X.com', phone: '0917', serviceRequired: 'Invitations', projectDescription: 'Hello', turnstileToken: 'good-token' } });
  assert.equal(res.status, 200, await res.clone().text());
  const [inq] = q('SELECT id, status FROM inquiries');
  assert.equal(inq.status, 'New');
  assert.equal(q('SELECT * FROM sent_emails').length, 0);

  smtpOn();
  const act = (body) => adminCall(adminInquiries, '/api/admin/inquiries', `/${inq.id}`, body, 'adm@jlc.test');
  await ok(await act({ action: 'reply', subject: 'Hi Eve', body: 'Happy to help' }));
  assert.equal(q('SELECT status FROM inquiries')[0].status, 'In Progress');
  assert.equal(q('SELECT * FROM sent_emails').length, 1);

  await ok(await act({ action: 'send-order-link', designSlug: 'classic-elegance', packageKey: 'standard' }));
  assert.equal(q('SELECT status FROM inquiries')[0].status, 'Converted');
  assert.deepEqual(q('SELECT email_type FROM sent_emails').map((r) => r.email_type).sort(), ['admin-reply', 'order-link']);
  assert.equal(mails().length, 2);
  assert.ok(mails()[1].includes('https://shop.test/designs/classic-elegance/customise?package=standard'));
});

test('journey: invite, verify-invite, login, token works, disable, 401', async () => {
  const inv = await ok(await adminCall(adminUsers, '/api/admin/users', '', { action: 'invite', email: 'New@X.com', fullName: 'New', role: 'Editor' }));
  assert.equal(inv.emailed, false);
  assert.equal(q("SELECT status FROM admins WHERE email = 'new@x.com'")[0].status, 'Invited');
  const token = new URL(inv.inviteLink.replace('#', '')).searchParams.get('token');

  await ok(await send(route, '/api/admin/verify-invite', { body: { email: 'new@x.com', token, password: 'longenough1' } }));
  assert.deepEqual({ ...q("SELECT status, verified FROM admins WHERE email = 'new@x.com'")[0] }, { status: 'Active', verified: 1 });

  const login = await ok(await send(route, '/api/admin/login', { body: { email: 'new@x.com', password: 'longenough1' } }));
  assert.equal(login.role, 'Editor');
  const orderList = () => send(adminOrders, '/api/admin/orders', { headers: { Authorization: 'Bearer ' + login.token } });
  assert.equal((await orderList()).status, 200);

  await ok(await adminCall(adminUsers, '/api/admin/users', '/new%40x.com', { action: 'disable' }));
  assert.equal(q("SELECT status FROM admins WHERE email = 'new@x.com'")[0].status, 'Disabled');
  assert.equal((await orderList()).status, 401);
});
