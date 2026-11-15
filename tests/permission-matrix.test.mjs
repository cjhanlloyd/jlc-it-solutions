// Permission matrix: one sample request per admin route, expected outcome per role written out by hand from the
// intended model (server/permissions.ts and the specs), not derived from can().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ADMIN_DIR = join(root, 'functions/api/admin');
const ROUTE_FILE = join(root, 'functions/api/[[route]].ts');

globalThis.fetch = async (url) => { throw new Error('Unexpected fetch ' + url); };

const SECRET = 'jwt-secret';
const PASSWORD = 'correct-horse-battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const ROLES = { Editor: 'des@jlc.test', Administrator: 'adm@jlc.test', 'Super Admin': 'boss@jlc.test' };
const { signAdminToken } = await bundle('server/crypto.ts');

// Each Function bundled once
const files = [];
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && files.push(join(dir, e.name)); };
walk(ADMIN_DIR);
// functions/api/admin/orders/[[path]].ts -> /api/admin/orders; dashboard.ts -> /api/admin/dashboard
const prefixOf = (f) => '/api/admin/' + relative(ADMIN_DIR, f).replace(/\\/g, '/').replace(/\/\[\[path\]\]\.ts$|\.ts$/, '');
const handlers = new Map();
for (const f of files) handlers.set(prefixOf(f), (await bundle(relative(root, f))).onRequest);
const catchAll = (await bundle('functions/api/[[route]].ts')).onRequest;
const handlerFor = (path) => {
  const p = path.split('?')[0];
  for (const [prefix, fn] of handlers) if (p === prefix || p.startsWith(prefix + '/')) return fn;
  return catchAll;
};

const A = 'allowed';
const PUBLIC = [A, A, A, A];
const SUPER_ONLY = [401, 403, 403, A];
const ADMINS = [401, 403, A, A];
const ALL_ROLES = [401, A, A, A];

// [route, body, [no token, Editor (Designer), Administrator, Super Admin]]
// Order 1 is unassigned and In Production (custom package), so it is in the Editor's scope; bodies fail validation
// after the permission check wherever possible, so no row mutates much.
const TABLE = [
  // dashboard.ts: orders.view, Designers see work counts only
  ['GET /api/admin/dashboard', null, ALL_ROLES],
  // payment-settings.ts: settings.payment
  ['GET /api/admin/payment-settings', null, SUPER_ONLY],
  ['POST /api/admin/payment-settings', { deadlineHours: 0 }, SUPER_ONLY],
  // activity: activity.view
  ['GET /api/admin/activity', null, ADMINS],
  // content: content.manage
  ['GET /api/admin/content', null, ADMINS],
  ['POST /api/admin/content', {}, ADMINS],
  // customers: customers.view
  ['GET /api/admin/customers', null, ADMINS],
  ['GET /api/admin/customers/1', null, ADMINS],
  ['POST /api/admin/customers/1', { name: '' }, ADMINS],
  // designs: designs.manage
  ['GET /api/admin/designs', null, ADMINS],
  ['GET /api/admin/designs/1', null, ADMINS],
  ['POST /api/admin/designs', { action: 'toggle' }, ADMINS],
  ['POST /api/admin/designs', { action: 'reorder' }, ADMINS],
  ['POST /api/admin/designs', { action: 'update' }, ADMINS],
  ['POST /api/admin/designs', { action: 'create' }, ADMINS],
  // email: settings.email
  ['GET /api/admin/email', null, SUPER_ONLY],
  ['POST /api/admin/email', { section: 'smtp' }, SUPER_ONLY],
  ['POST /api/admin/email', { section: 'template' }, SUPER_ONLY],
  ['POST /api/admin/email', { section: 'test' }, SUPER_ONLY],
  // inquiries: inquiries.manage
  ['GET /api/admin/inquiries', null, ADMINS],
  ['GET /api/admin/inquiries/q1', null, ADMINS],
  ['GET /api/admin/inquiries/q1/attachment', null, ADMINS],
  ['POST /api/admin/inquiries/q1', { action: 'status' }, ADMINS],
  ['POST /api/admin/inquiries/q1', { action: 'notes', notes: 'x'.repeat(5000) }, ADMINS],
  ['POST /api/admin/inquiries/q1', { action: 'reply' }, ADMINS],
  ['POST /api/admin/inquiries/q1', { action: 'send-order-link' }, ADMINS],
  ['POST /api/admin/inquiries/missing', { action: 'delete' }, ADMINS],
  // invitations: orders.view, so Designers see invitations and RSVPs
  ['GET /api/admin/invitations/overview', null, ALL_ROLES],
  ['GET /api/admin/invitations/invitations/1/rsvps', null, ALL_ROLES],
  // orders: orders.view, then each branch's own permission
  ['GET /api/admin/orders', null, ALL_ROLES],
  ['GET /api/admin/orders/1', null, ALL_ROLES],
  ['GET /api/admin/orders/1/receipts/1', null, ADMINS], // payments.review
  ['GET /api/admin/orders/1/proofs/1', null, ALL_ROLES], // orders.work
  ['POST /api/admin/orders/1', { action: 'approve' }, ADMINS], // payments.review
  ['POST /api/admin/orders/1', { action: 'reject' }, ADMINS], // payments.review
  ['POST /api/admin/orders/1', { action: 'status', to: 'in_production' }, ALL_ROLES], // orders.work
  ['POST /api/admin/orders/1', { action: 'status', to: 'cancelled', note: 'x'.repeat(1001) }, ADMINS], // orders.refund
  ['POST /api/admin/orders/1', { action: 'deliver' }, ALL_ROLES], // orders.work (custom, unapproved: 409)
  ['POST /api/admin/orders/1', { action: 'refund', note: 'x'.repeat(1001) }, ADMINS], // orders.refund
  ['POST /api/admin/orders/1', { action: 'assign', email: 'nobody@jlc.test' }, ADMINS], // orders.assign
  ['POST /api/admin/orders/1', { action: 'note', body: '' }, ALL_ROLES], // orders.work
  ['POST /api/admin/orders/1', { action: 'proof' }, ALL_ROLES], // orders.work
  ['POST /api/admin/orders/1', { action: 'resend' }, ADMINS], // orders.contact
  // reports: reports.view
  ['GET /api/admin/reports?from=2026-11-01&to=2026-11-14', null, ADMINS],
  ['GET /api/admin/reports/export/orders?from=2026-11-01&to=2026-11-14', null, ADMINS],
  ['GET /api/admin/reports/export/payments?from=2026-11-01&to=2026-11-14', null, ADMINS],
  ['GET /api/admin/reports/export/inquiries?from=2026-11-01&to=2026-11-14', null, ADMINS],
  // users: users.manage
  ['GET /api/admin/users', null, SUPER_ONLY],
  ['POST /api/admin/users', { action: 'invite' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'role' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'disable' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'enable' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'resend-invite' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'send-reset' }, SUPER_ONLY],
  ['POST /api/admin/users/nobody%40jlc.test', { action: 'delete' }, SUPER_ONLY],
  // [[route]].ts: public auth routes
  ['POST /api/admin/login', { email: 'boss@jlc.test', password: PASSWORD }, PUBLIC],
  ['POST /api/admin/verify-invite', { email: 'x@jlc.test', token: 'bad', password: 'x' }, PUBLIC],
  ['POST /api/admin/forgot-password', { email: 'x@jlc.test' }, PUBLIC],
  ['POST /api/admin/reset-password', { email: 'x@jlc.test', token: 'bad', password: 'x' }, PUBLIC],
  // [[route]].ts: IT content, content.manage
  ['GET /api/admin/data', null, ADMINS],
  ['POST /api/admin/settings/content', {}, ADMINS],
  ['POST /api/admin/services', {}, ADMINS],
  ['POST /api/admin/faqs', {}, ADMINS],
  ['POST /api/admin/gallery', {}, ADMINS],
  ['POST /api/admin/process', {}, ADMINS],
  ['POST /api/admin/roadmap', {}, ADMINS],
];

const seed = () => {
  const db = makeD1();
  const r2 = makeR2();
  const x = db.exec;
  for (const [role, email] of Object.entries(ROLES))
    x.prepare("INSERT INTO admins (email, fullName, role, status, verified, passwordHash, createdAt) VALUES (?, ?, ?, 'Active', 1, ?, 't')").run(email, role, role, HASH);
  x.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation')`);
  x.exec(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
    VALUES (1, 1, 's-1', '{"name":"Blush"}', '{"partner1":"Maria","partner2":"Juan"}', '[]', 'pending', '2027-06-12', 'h1'),
           (2, 1, 's-2', '{"name":"Blush"}', '{"partner1":"Ana","partner2":"Ben"}', '[]', 'pending', '2027-06-12', 'h2')`);
  x.exec("INSERT INTO customers (id, email, name, phone) VALUES (1, 'maria@example.com', 'Maria Cruz', '0917')");
  // 1: unassigned In Production (Editor scope); 2: assigned to the Administrator (outside the Editor's scope)
  x.exec(`INSERT INTO orders (id, product_id, customer_email, amount_centavos, status, reference, customer_id, provider, payment_deadline, package_kind, assigned_to)
    VALUES (1, 1, 'maria@example.com', 99900, 'in_production', 'JLC-AAAAA1', 1, 'manual_gcash', '2099-01-01T00:00:00.000Z', 'custom', NULL),
           (2, 2, 'maria@example.com', 99900, 'in_production', 'JLC-AAAAA2', 1, 'manual_gcash', '2099-01-01T00:00:00.000Z', 'custom', 'adm@jlc.test')`);
  x.exec("INSERT INTO payments (id, order_id, provider, amount_centavos, status, receipt_key, submitted_at) VALUES (1, 1, 'manual_gcash', 99900, 'confirmed', 'receipts/1/1.png', 't')");
  r2.map.set('receipts/1/1.png', { body: 'png', bytes: new Uint8Array([1]), httpMetadata: { contentType: 'image/png' } });
  x.exec(`INSERT INTO inquiries (id, fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt)
    VALUES ('q1', 'Ann', '', 'ann@example.com', '1', 'Web', 'd', 'email', 'New', '2026-11-01T00:00:00.000Z')`);
  return { db, r2 };
};

// A fresh database per request, so no row's side effects reach another
const call = async (route, body, role) => {
  const [method, path] = route.split(' ');
  const { db, r2 } = seed();
  const headers = role ? { Authorization: 'Bearer ' + await signAdminToken(ROLES[role], SECRET) } : {};
  const background = [];
  const res = await handlerFor(path)({
    request: new Request('https://shop.test' + path, { method, headers, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined }),
    env: { DB: db, PHOTOS: r2, JWT_SECRET: SECRET }, params: {}, waitUntil: (p) => background.push(p),
  });
  await Promise.allSettled(background);
  return res.status;
};

// A 5xx is a crash, never "allowed"; it fails the row (named in the error list) whatever the expectation
const outcome = (status) => (status >= 500 ? `server error ${status}` : status === 401 || status === 403 ? status : A);

test('a 5xx is never "allowed", whatever the expectation', () => {
  for (const s of [500, 502]) for (const e of [A, 401, 403]) assert.notEqual(outcome(s), e, `${s} must fail a row expecting ${e}`);
  assert.equal(outcome(200), A);
  assert.equal(outcome(404), A);
});

test('permission matrix: every admin route, every role', async () => {
  const errors = [];
  for (const [route, body, expected] of TABLE) {
    for (const [i, role] of [null, 'Editor', 'Administrator', 'Super Admin'].entries()) {
      const status = await call(route, body, role);
      if (outcome(status) !== expected[i]) errors.push(`${route} ${JSON.stringify(body)} as ${role ?? 'no token'}: expected ${expected[i]}, got ${status}`);
    }
  }
  assert.deepEqual(errors, []);
});

test('Editor scope: unassigned production work is visible, another admin\'s order looks unknown', async () => {
  assert.equal(await call('GET /api/admin/orders/1', null, 'Editor'), 200);
  assert.equal(await call('GET /api/admin/orders/2', null, 'Editor'), 404);
  assert.equal(await call('GET /api/admin/orders/2', null, 'Administrator'), 200);
});

// shortcut: a new sub-route inside an existing catch-all file is not detected here (only files and [[route]].ts literals are); add its row by hand, upgrade to parsing route.match() patterns if catch-alls grow.
test('guard: every admin Function file and every /api/admin path in [[route]].ts is in the table', () => {
  const paths = TABLE.map(([route]) => route.split(' ')[1].split('?')[0]);
  const covered = (p) => paths.some((q) => q === p || q.startsWith(p + '/'));
  const missingFiles = files.map(prefixOf).filter((p) => !covered(p));
  assert.deepEqual(missingFiles, [], 'admin Function files with no row');
  const literals = [...readFileSync(ROUTE_FILE, 'utf8').matchAll(/'(\/api\/admin\/[a-z/-]+)'/g)].map((m) => m[1]);
  assert.ok(literals.length >= 11, 'the [[route]].ts literals were found');
  assert.deepEqual([...new Set(literals)].filter((p) => !paths.includes(p)), [], '[[route]].ts admin paths with no row');
});
