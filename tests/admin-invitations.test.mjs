// Tests for the admin invitations API (designs, orders, refunds, resend). Run: npm test
// Handlers are bundled with esbuild; D1 and SMTP are in-memory fakes.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
let admin, guestApi, signAdminToken, runCleanup;
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jlc-adminv-'));
  const bundle = async (entry, name) => {
    const outfile = join(dir, name);
    await build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm',
      outfile, logLevel: 'warning', alias: { 'cloudflare:sockets': join(root, 'tests/smtp-stub.mjs') } });
    return import(pathToFileURL(outfile).href);
  };
  admin = (await bundle('functions/api/admin/invitations/[[path]].ts', 'admin.mjs')).onRequest;
  guestApi = (await bundle('functions/api/invitations/[[path]].ts', 'guest.mjs')).onRequest;
  ({ signAdminToken } = await bundle('server/crypto.ts', 'crypto.mjs'));
  ({ runCleanup } = await bundle('server/cleanup.ts', 'cleanup.mjs'));
});

const sha = (s) => createHash('sha256').update(s).digest('hex');
const scheme = { name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' };
const details = { partner1: 'Ana', partner2: 'Ben', eventDate: '2099-06-01', ceremony: { name: 'Chapel', address: '1 Main St', mapUrl: '' }, schedule: [] };
const goodDesign = { slug: 'new-look', name: 'New Look', layout_key: 'garden', price_centavos: 149900, color_schemes: [scheme],
  preview_images: ['https://cdn.test/a.jpg'], sample_details: details, active: true };

let db, smtpEnabled;
const ADMINS = { 'boss@x.com': 'Super Admin', 'adm@x.com': 'Administrator', 'ed@x.com': 'Editor' };
beforeEach(() => {
  db = {
    designs: [
      { id: 1, slug: 'classic', name: 'Classic', layout_key: 'classic', price_centavos: 99900, color_schemes: JSON.stringify([scheme]), preview_images: '[]', sample_details: '{}', active: 1, sort_order: 1 },
      { id: 2, slug: 'garden', name: 'Garden', layout_key: 'garden', price_centavos: 79900, color_schemes: JSON.stringify([scheme]), preview_images: '[]', sample_details: '{}', active: 1, sort_order: 2 },
    ],
    invitations: [
      { id: 1, design_id: 1, slug: 'ana-ben-1', color_scheme: '{}', details: JSON.stringify(details), photos: '[]', status: 'live', event_date: '2099-06-01', manage_token_hash: sha('old-token'), created_at: 't' },
      { id: 2, design_id: 1, slug: 'cy-di-2', color_scheme: '{}', details: JSON.stringify(details), photos: '[]', status: 'pending', event_date: '2099-06-01', manage_token_hash: sha('t2'), created_at: 't' },
    ],
    orders: [
      { id: 1, product_id: 1, customer_email: 'ana@example.com', amount_centavos: 99900, status: 'paid', created_at: 't', paid_at: 't' },
      { id: 2, product_id: 2, customer_email: 'cy@example.com', amount_centavos: 50000, status: 'pending', created_at: 't', paid_at: null },
    ],
    events: [{ paymongo_event_id: 'evt_1', type: 'checkout_session.payment.paid', order_id: 1, received_at: 't', payload: 'SECRET-RAW' }],
    rsvps: [{ id: 1, invitation_id: 1, guest_name: 'Gus', attending: 1, party_size: 2, message: 'Yay', created_at: 't' }],
    audit: [],
  };
  smtpEnabled = true;
  r2.clear();
  r2Fails = false;
  globalThis.SMTP_SENT = [];
  globalThis.SMTP_FAIL = false;
});

const NAMES_SQL = "json_object('partner1', json_extract(details, '$.partner1'), 'partner2', json_extract(details, '$.partner2'))";
const PURGE_SELECT = `SELECT id, event_date, photos FROM invitations WHERE status = 'live' OR (status IN ('expired', 'refunded') AND (photos != '[]' OR details != ${NAMES_SQL} OR id IN (SELECT invitation_id FROM rsvps)))`;
const PURGE_UPDATE = `UPDATE invitations SET status = CASE WHEN status = 'refunded' THEN 'refunded' ELSE 'expired' END, photos = '[]', details = ${NAMES_SQL} WHERE id = ? AND status IN ('live', 'expired', 'refunded')`;
const namesOnly = (details) => { const d = JSON.parse(details); return JSON.stringify({ partner1: d.partner1 ?? null, partner2: d.partner2 ?? null }); };
function exec(sql, a) {
  if (/FROM admins WHERE email/.test(sql)) return a[0] in ADMINS ? { email: a[0], fullName: a[0], role: ADMINS[a[0]] } : null;
  if (/^SELECT \* FROM products_designs ORDER BY/.test(sql)) return { results: [...db.designs].sort((x, y) => x.sort_order - y.sort_order || x.id - y.id) };
  if (/^SELECT o\.id, .* FROM orders o LEFT JOIN invitations i .* ORDER BY/.test(sql)) {
    return { results: db.orders.map(o => { const i = db.invitations.find(x => x.id === o.product_id); return { ...o, invitation_id: o.product_id, slug: i?.slug ?? null, design_name: i ? db.designs.find(d => d.id === i.design_id).name : null }; }) };
  }
  if (/^SELECT order_id, type, received_at FROM payment_events/.test(sql)) return { results: db.events.map(({ order_id, type, received_at }) => ({ order_id, type, received_at })) };
  if (/^SELECT i\.id, i\.slug, .* FROM invitations i JOIN products_designs d/.test(sql)) {
    return { results: db.invitations.map(i => ({ ...i, manage_token_hash: undefined, design_name: db.designs.find(d => d.id === i.design_id).name, rsvpCount: db.rsvps.filter(r => r.invitation_id === i.id).length })) };
  }
  if (/^SELECT COUNT\(\*\) AS paidCount, COALESCE\(SUM\(amount_centavos\), 0\) AS paidCentavos FROM orders WHERE status = 'paid'/.test(sql)) {
    const paid = db.orders.filter(o => o.status === 'paid');
    return { paidCount: paid.length, paidCentavos: paid.reduce((s, o) => s + o.amount_centavos, 0) };
  }
  if (/^SELECT id FROM products_designs WHERE slug = \? AND id != \?/.test(sql)) return db.designs.find(d => d.slug === a[0] && d.id !== a[1]) ?? null;
  if (/^SELECT id FROM products_designs WHERE slug = \?/.test(sql)) return db.designs.find(d => d.slug === a[0]) ?? null;
  if (/^INSERT INTO products_designs/.test(sql)) {
    const id = Math.max(...db.designs.map(d => d.id)) + 1;
    db.designs.push({ id, slug: a[0], name: a[1], layout_key: a[2], price_centavos: a[3], color_schemes: a[4], preview_images: a[5], sample_details: a[6], active: a[7], sort_order: Math.max(...db.designs.map(d => d.sort_order)) + 1 });
    return { meta: { last_row_id: id, changes: 1 } };
  }
  if (/^SELECT layout_key FROM products_designs WHERE id = \?/.test(sql)) return db.designs.find(d => d.id === a[0]) ?? null;
  if (/^UPDATE products_designs SET slug = \?/.test(sql)) {
    const d = db.designs.find(x => x.id === a[7]);
    if (!d) return { meta: { changes: 0 } };
    Object.assign(d, { slug: a[0], name: a[1], price_centavos: a[2], color_schemes: a[3], preview_images: a[4], sample_details: a[5], active: a[6] });
    return { meta: { changes: 1 } };
  }
  if (/^UPDATE products_designs SET active = \? WHERE id = \?/.test(sql)) {
    const d = db.designs.find(x => x.id === a[1]);
    if (d) d.active = a[0];
    return { meta: { changes: d ? 1 : 0 } };
  }
  if (/^UPDATE products_designs SET sort_order = \? WHERE id = \?/.test(sql)) {
    const d = db.designs.find(x => x.id === a[1]);
    if (d) d.sort_order = a[0];
    return { meta: { changes: d ? 1 : 0 } };
  }
  if (/^SELECT o\.id, o\.status, o\.customer_email, o\.product_id, i\.slug, i\.status AS invitation_status FROM orders o JOIN invitations i ON i\.id = o\.product_id WHERE o\.id = \?/.test(sql)) {
    const o = db.orders.find(x => x.id === a[0]);
    if (!o) return null;
    const i = db.invitations.find(x => x.id === o.product_id);
    return { ...o, slug: i.slug, invitation_status: i.status };
  }
  if (/^UPDATE orders SET status = 'refunded' WHERE id = \? AND status = 'paid'/.test(sql)) {
    const o = db.orders.find(x => x.id === a[0]);
    if (o?.status !== 'paid') return { meta: { changes: 0 } };
    o.status = 'refunded';
    return { meta: { changes: 1 } };
  }
  if (/^UPDATE invitations SET status = 'refunded' WHERE id = \?/.test(sql)) { db.invitations.find(x => x.id === a[0]).status = 'refunded'; return { meta: { changes: 1 } }; }
  if (/^INSERT INTO audit_logs \(timestamp, log_type, message\) VALUES \(\?, 'security', \?\)/.test(sql)) { db.audit.push({ log_type: 'security', message: a[1] }); return { meta: { changes: 1 } }; }
  if (/^UPDATE invitations SET manage_token_hash = \? WHERE id = \? AND status = 'live'/.test(sql)) {
    const i = db.invitations.find(x => x.id === a[1]);
    if (i?.status !== 'live') return { meta: { changes: 0 } };
    i.manage_token_hash = a[0];
    return { meta: { changes: 1 } };
  }
  if (/^SELECT guest_name, attending, party_size, message, created_at FROM rsvps WHERE invitation_id = \?/.test(sql)) return { results: db.rsvps.filter(r => r.invitation_id === a[0]) };
  if (/^SELECT i\.\*, d.layout_key, d.product_type FROM invitations i JOIN products_designs d ON d\.id = i\.design_id WHERE i\.slug = \?/.test(sql)) {
    const i = db.invitations.find(x => x.slug === a[0]);
    return i ? { ...i, layout_key: db.designs.find(d => d.id === i.design_id).layout_key, product_type: 'wedding_invitation' } : null;
  }
  // --- Task 11: cleanup ---
  if (/^SELECT o\.id, o\.status, i\.id AS invitation_id, i\.photos FROM orders o JOIN invitations i ON i\.id = o\.product_id WHERE o\.status IN \('pending', 'expired'\) AND i\.status = 'pending' AND o\.created_at < \?$/.test(sql)) {
    return { results: db.orders.filter(o => ['pending', 'expired'].includes(o.status) && o.created_at < a[0])
      .map(o => ({ o, i: db.invitations.find(x => x.id === o.product_id && x.status === 'pending') })).filter(x => x.i)
      .map(({ o, i }) => ({ id: o.id, status: o.status, invitation_id: i.id, photos: i.photos })) };
  }
  if (/^UPDATE orders SET status = 'expired' WHERE id = \? AND status = 'pending'$/.test(sql)) {
    const o = db.orders.find(x => x.id === a[0]);
    if (o?.status !== 'pending') return { meta: { changes: 0 } };
    o.status = 'expired';
    return { meta: { changes: 1 } };
  }
  if (/^DELETE FROM invitations WHERE id = \? AND status = 'pending'$/.test(sql)) {
    const n = db.invitations.length;
    db.invitations = db.invitations.filter(i => !(i.id === a[0] && i.status === 'pending'));
    return { meta: { changes: n - db.invitations.length } };
  }
  // Purge: keeps only the names in details, like SQLite's json_object(json_extract(...)) (missing → null)
  if (sql === PURGE_SELECT) {
    return { results: db.invitations.filter(i => i.status === 'live' || (['expired', 'refunded'].includes(i.status)
      && (i.photos !== '[]' || i.details !== namesOnly(i.details) || db.rsvps.some(r => r.invitation_id === i.id)))) };
  }
  if (sql === PURGE_UPDATE) {
    const i = db.invitations.find(x => x.id === a[0] && ['live', 'expired', 'refunded'].includes(x.status));
    if (i) Object.assign(i, { status: i.status === 'refunded' ? 'refunded' : 'expired', photos: '[]', details: namesOnly(i.details) });
    return { meta: { changes: i ? 1 : 0 } };
  }
  if (/^DELETE FROM rsvps WHERE invitation_id = \?$/.test(sql)) { db.rsvps = db.rsvps.filter(r => r.invitation_id !== a[0]); return { meta: { changes: 1 } }; }
  if (/smtp_settings/.test(sql)) return { enabled: smtpEnabled ? 1 : 0, host: 'h', port: 587, senderName: 'JLC', senderEmail: 'co@x.com' };
  if (/FROM (branding|content)/.test(sql)) return null;
  throw new Error('Unexpected SQL: ' + sql);
}
const stmt = (sql) => {
  const q = { args: [], bind(...a) { q.args = a; return q; },
    async first() { return exec(sql, q.args); }, async all() { return exec(sql, q.args); }, async run() { return exec(sql, q.args); } };
  return q;
};
const DB = { prepare: stmt, async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; } };

// --- Fake R2 ---
const r2 = new Map();
let r2Fails = false;
const PHOTOS = { async delete(keys) { if (r2Fails) throw new Error('R2 down'); for (const k of [].concat(keys)) r2.delete(k); } };

const SECRET = 'jwt-secret';
const call = async (path, { as, body } = {}) => {
  const headers = as ? { Authorization: 'Bearer ' + await signAdminToken(as, SECRET) } : {};
  return admin({ request: new Request('https://shop.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers }),
    env: { DB, PHOTOS, JWT_SECRET: SECRET }, waitUntil() {} });
};
const designs = (body, as = 'boss@x.com') => call('/api/admin/invitations/designs', { as, body });
const guestGet = (slug) => guestApi({ request: new Request('https://shop.test/api/invitations/i/' + slug), env: { DB }, waitUntil() {} });

test('no token → 401', async () => {
  assert.equal((await call('/api/admin/invitations/overview')).status, 401);
  assert.equal((await call('/api/admin/invitations/designs', { body: goodDesign })).status, 401);
});

test('Editor: POST → 403, GET overview → 200', async () => {
  assert.equal((await designs({ action: 'add', ...goodDesign }, 'ed@x.com')).status, 403);
  assert.equal((await call('/api/admin/invitations/orders/refund', { as: 'ed@x.com', body: { orderId: 1 } })).status, 403);
  assert.equal((await call('/api/admin/invitations/overview', { as: 'ed@x.com' })).status, 200);
});

test('overview: totals count paid orders only; events have no payload; no token hashes', async () => {
  db.orders.push({ id: 3, product_id: 2, customer_email: 'z@x.com', amount_centavos: 7000, status: 'refunded', created_at: 't', paid_at: 't' });
  const res = await call('/api/admin/invitations/overview', { as: 'adm@x.com' });
  const data = await res.json();
  assert.deepEqual(data.totals, { paidCount: 1, paidCentavos: 99900 });
  assert.equal(data.designs.length, 2);
  assert.deepEqual(data.designs[0].color_schemes, [scheme]);
  assert.equal(data.invitations.find(i => i.id === 1).rsvpCount, 1);
  assert.deepEqual(data.orders.find(o => o.id === 1).payment_events, [{ type: 'checkout_session.payment.paid', received_at: 't' }]);
  assert.deepEqual(data.orders.find(o => o.id === 2).payment_events, []);
  const text = JSON.stringify(data);
  assert.ok(!text.includes('SECRET-RAW') && !text.includes('manage_token_hash') && !text.includes(sha('old-token')));
});

test('design add: valid → 200 and appended; Administrator may write', async () => {
  const res = await designs({ action: 'add', ...goodDesign }, 'adm@x.com');
  assert.equal(res.status, 200);
  const d = db.designs.at(-1);
  assert.equal(d.slug, 'new-look');
  assert.equal(d.active, 1);
  assert.deepEqual(JSON.parse(d.color_schemes), [scheme]);
});

test('design validation → 400', async () => {
  const bad = [
    { layout_key: 'nope' }, { price_centavos: 0 }, { price_centavos: 999 }, { price_centavos: 10_000_001 }, { price_centavos: 1500.5 },
    { slug: 'Bad Slug' }, { slug: 'a--b' }, { slug: 'x'.repeat(61) }, { name: '' }, { name: 'n'.repeat(81) },
    { color_schemes: [] }, { color_schemes: [{ ...scheme, primary: 'red' }] }, { color_schemes: [{ ...scheme, name: '' }] },
    { preview_images: ['http://insecure/a.jpg'] }, { preview_images: 'x' }, { sample_details: { partner1: 'only' } },
  ];
  for (const patch of bad) {
    const res = await designs({ action: 'add', ...goodDesign, ...patch });
    assert.equal(res.status, 400, JSON.stringify(patch));
  }
  assert.equal(db.designs.length, 2);
  assert.equal((await designs({ action: 'bogus' })).status, 400);
});

test('design add/update with a taken slug → 409', async () => {
  assert.equal((await designs({ action: 'add', ...goodDesign, slug: 'classic' })).status, 409);
  assert.equal((await designs({ action: 'update', id: 2, ...goodDesign, slug: 'classic' })).status, 409);
});

test('design update changes the design only; keeps its own slug; unknown id → 404', async () => {
  const res = await designs({ action: 'update', id: 1, ...goodDesign, layout_key: 'classic', slug: 'classic', name: 'Renamed', price_centavos: 120000 });
  assert.equal(res.status, 200);
  assert.equal(db.designs[0].name, 'Renamed');
  assert.equal(db.designs[0].price_centavos, 120000);
  assert.equal(db.invitations[0].color_scheme, '{}');
  assert.equal((await designs({ action: 'update', id: 99, ...goodDesign })).status, 404);
});

test('design update with a different layout_key → 409, stored layout unchanged; same layout_key succeeds', async () => {
  const res = await designs({ action: 'update', id: 1, ...goodDesign, slug: 'classic', layout_key: 'garden' });
  assert.equal(res.status, 409);
  assert.equal(db.designs[0].layout_key, 'classic');
  assert.equal(db.designs[0].name, 'Classic');
  assert.equal((await designs({ action: 'update', id: 1, ...goodDesign, slug: 'classic', layout_key: 'classic' })).status, 200);
  assert.equal(db.designs[0].layout_key, 'classic');
});

test('design toggle and reorder', async () => {
  assert.equal((await designs({ action: 'toggle', id: 1, active: false })).status, 200);
  assert.equal(db.designs[0].active, 0);
  assert.equal((await designs({ action: 'toggle', id: 1, active: 'no' })).status, 400);
  assert.equal((await designs({ action: 'toggle', id: 99, active: true })).status, 404);
  assert.equal((await designs({ action: 'reorder', ids: [2, 1] })).status, 200);
  assert.deepEqual(db.designs.map(d => [d.id, d.sort_order]), [[1, 2], [2, 1]]);
  assert.equal((await designs({ action: 'reorder', ids: [1, 1] })).status, 400);
  assert.equal((await designs({ action: 'reorder', ids: [] })).status, 400);
});

test('refund: flips order and invitation, logs who, guest API then 404', async () => {
  assert.equal((await guestGet('ana-ben-1')).status, 200);
  const res = await call('/api/admin/invitations/orders/refund', { as: 'adm@x.com', body: { orderId: 1 } });
  assert.equal(res.status, 200);
  assert.equal(db.orders[0].status, 'refunded');
  assert.equal(db.invitations[0].status, 'refunded');
  assert.match(db.audit[0].message, /adm@x\.com.*order 1/);
  assert.equal((await guestGet('ana-ben-1')).status, 404);
});

test('refund: only from paid (pending, already refunded, unknown) → 409/404', async () => {
  const refund = (orderId) => call('/api/admin/invitations/orders/refund', { as: 'boss@x.com', body: { orderId } });
  assert.equal((await refund(2)).status, 409);
  assert.equal(db.orders[1].status, 'pending');
  assert.equal((await refund(1)).status, 200);
  assert.equal((await refund(1)).status, 409);
  assert.equal((await refund(99)).status, 404);
  assert.equal(db.audit.length, 1);
});

const resend = (orderId, as = 'boss@x.com') => call('/api/admin/invitations/orders/resend', { as, body: { orderId } });

test('resend: emails both links, rotates the token after the send', async () => {
  const res = await resend(1);
  assert.equal(res.status, 200);
  const mail = globalThis.SMTP_SENT.join('');
  assert.match(mail, /ana@example\.com/);
  assert.match(mail, /\/i\/ana-ben-1/);
  const token = mail.match(/\/manage#([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(token);
  assert.equal(db.invitations[0].manage_token_hash, sha(token));
});

test('resend: SMTP disabled → 409, nothing changes', async () => {
  smtpEnabled = false;
  const res = await resend(1);
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: 'Email is not configured; enable SMTP first.' });
  assert.equal(db.invitations[0].manage_token_hash, sha('old-token'));
  assert.equal(globalThis.SMTP_SENT.length, 0);
});

test('resend: a failed send keeps the old token; non-paid order → 409', async () => {
  globalThis.SMTP_FAIL = true;
  assert.ok((await resend(1)).status >= 500);
  assert.equal(db.invitations[0].manage_token_hash, sha('old-token'));
  globalThis.SMTP_FAIL = false;
  assert.equal((await resend(2)).status, 409);
  assert.equal((await resend(99)).status, 404);
  assert.equal((await resend(1, 'ed@x.com')).status, 403);
});

test('invitation RSVPs list', async () => {
  const res = await call('/api/admin/invitations/invitations/1/rsvps', { as: 'ed@x.com' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).rsvps, [{ guestName: 'Gus', attending: true, partySize: 2, message: 'Yay', submitted: 't' }]);
  assert.equal((await call('/api/admin/invitations/nope', { as: 'ed@x.com' })).status, 404);
});

// --- Cleanup (Task 11) ---
const NOW = new Date('2026-11-10T12:00:00Z');
const H = 3_600_000, DAY = 24 * H;
const sqlTime = (ms, now = NOW) => new Date(now.getTime() - ms).toISOString().replace('T', ' ').slice(0, 19); // CURRENT_TIMESTAMP format
const dateDaysAgo = (n) => new Date(Date.parse('2026-11-10T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
// Pending order <id> (created <age> ms before <now>) with invitation <id> holding one R2 photo
const pendingOrder = (id, age, now = NOW) => {
  const key = `inv/${id}/0.png`;
  r2.set(key, 'img');
  db.invitations.push({ id, design_id: 1, slug: `p-${id}`, color_scheme: '{}', details: '{}', photos: JSON.stringify([key]), status: 'pending', event_date: '2099-06-01', manage_token_hash: sha('p' + id), created_at: sqlTime(age, now) });
  db.orders.push({ id, product_id: id, customer_email: `p${id}@x.com`, amount_centavos: 99900, status: 'pending', created_at: sqlTime(age, now), paid_at: null });
};
// Live invitation <id> whose event was <days> before NOW, with one photo and one RSVP
const FULL_DETAILS = { partner1: 'Maria', partner2: 'Juan', eventDate: '2026-01-01', ceremony: { name: 'St. Joseph', address: '1 Main St' }, message: 'See you!', giftsNote: 'GCash 0917' };
const liveInvitation = (id, days, status = 'live') => {
  const key = `inv/${id}/0.png`;
  r2.set(key, 'img');
  db.invitations.push({ id, design_id: 1, slug: `l-${id}`, color_scheme: '{}', details: JSON.stringify(FULL_DETAILS), photos: JSON.stringify([key]), status, event_date: dateDaysAgo(days), manage_token_hash: sha('l' + id), created_at: 't' });
  db.rsvps.push({ id: 100 + id, invitation_id: id, guest_name: 'G', attending: 1, party_size: 1, message: '', created_at: 't' });
};

test('cleanup: a pending order 73 h old → expired, its invitation and photos deleted; the order row stays', async () => {
  pendingOrder(10, 73 * H);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 1, purgedInvitations: 0 });
  assert.equal(db.orders.find(o => o.id === 10).status, 'expired');
  assert.equal(db.invitations.find(i => i.id === 10), undefined);
  assert.equal(r2.has('inv/10/0.png'), false);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 }, 'idempotent');
});

test('cleanup: a pending order 71 h old → untouched', async () => {
  pendingOrder(10, 71 * H);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 });
  assert.equal(db.orders.find(o => o.id === 10).status, 'pending');
  assert.equal(db.invitations.find(i => i.id === 10).status, 'pending');
  assert.equal(r2.has('inv/10/0.png'), true);
});

test('cleanup: a live invitation 61 days after the event → expired, RSVPs and photos deleted, row kept', async () => {
  liveInvitation(20, 61);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 1 });
  const i = db.invitations.find(x => x.id === 20);
  assert.equal(i.status, 'expired');
  assert.equal(i.photos, '[]');
  assert.equal(i.slug, 'l-20');
  assert.equal(db.rsvps.filter(r => r.invitation_id === 20).length, 0);
  assert.equal(r2.has('inv/20/0.png'), false);
  assert.equal(db.rsvps.filter(r => r.invitation_id === 1).length, 1, 'other RSVPs kept');
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 }, 'idempotent');
});

test('cleanup: a live invitation 59 days after the event → untouched', async () => {
  liveInvitation(20, 59);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 });
  assert.equal(db.invitations.find(x => x.id === 20).status, 'live');
  assert.equal(db.rsvps.filter(r => r.invitation_id === 20).length, 1);
  assert.equal(r2.has('inv/20/0.png'), true);
});

test('cleanup: purges an invitation the guest page already marked expired', async () => {
  liveInvitation(20, 61);
  db.invitations.find(x => x.id === 20).status = 'expired';
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 1 });
  assert.equal(db.rsvps.filter(r => r.invitation_id === 20).length, 0);
  assert.equal(r2.has('inv/20/0.png'), false);
});

test('cleanup: an expired purge keeps only the two names in details', async () => {
  liveInvitation(20, 61);
  await runCleanup(DB, PHOTOS, NOW);
  assert.deepEqual(JSON.parse(db.invitations.find(x => x.id === 20).details), { partner1: 'Maria', partner2: 'Juan' });
});

test('cleanup: a refunded invitation 61 days after the event → photos, RSVPs and details purged, stays refunded', async () => {
  liveInvitation(20, 61, 'refunded');
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 1 });
  const i = db.invitations.find(x => x.id === 20);
  assert.equal(i.status, 'refunded');
  assert.equal(i.photos, '[]');
  assert.deepEqual(JSON.parse(i.details), { partner1: 'Maria', partner2: 'Juan' });
  assert.equal(db.rsvps.filter(r => r.invitation_id === 20).length, 0);
  assert.equal(r2.has('inv/20/0.png'), false);
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 }, 'idempotent');
});

test('cleanup: a refunded invitation 59 days after the event → untouched', async () => {
  liveInvitation(20, 59, 'refunded');
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 0 });
  const i = db.invitations.find(x => x.id === 20);
  assert.deepEqual(JSON.parse(i.details), FULL_DETAILS);
  assert.equal(r2.has('inv/20/0.png'), true);
  assert.equal(db.rsvps.filter(r => r.invitation_id === 20).length, 1);
});

test('cleanup: an R2 failure is logged and the row is retried on the next run', async () => {
  pendingOrder(10, 73 * H);
  liveInvitation(20, 61);
  r2Fails = true;
  const err = console.error; console.error = () => {};
  try { await runCleanup(DB, PHOTOS, NOW); } finally { console.error = err; }
  assert.ok(db.invitations.find(i => i.id === 10), 'pending invitation kept until its photos are gone');
  assert.equal(db.invitations.find(i => i.id === 20).status, 'live');
  r2Fails = false;
  assert.deepEqual(await runCleanup(DB, PHOTOS, NOW), { expiredOrders: 0, purgedInvitations: 1 });
  assert.equal(db.invitations.find(i => i.id === 10), undefined);
  assert.equal(db.orders.find(o => o.id === 10).status, 'expired');
  assert.equal(r2.size, 0);
});

test('overview runs cleanup first; an expired order still lists without its invitation', async () => {
  pendingOrder(10, 4 * DAY, new Date()); // the overview uses the real clock
  const data = await (await call('/api/admin/invitations/overview', { as: 'ed@x.com' })).json();
  const o = data.orders.find(x => x.id === 10);
  assert.equal(o.status, 'expired');
  assert.equal(o.slug, null);
  assert.equal(data.invitations.find(i => i.id === 10), undefined);
  assert.equal(r2.size, 0);
});
