// Guest photo uploads (Premium) and moderation by the organiser and the shop admin. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: admin } = await bundle('functions/api/admin/invitations/[[path]].ts');
const { onRequestGet: photoRoute } = await bundle('functions/photos/[[key]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');
const { runCleanup } = await bundle('server/cleanup.ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: new URLSearchParams(init.body).get('response') === 'good-token' });
  throw new Error('Unexpected fetch ' + url);
};

const hash = (s) => createHash('sha256').update(s).digest('hex');
const SCHEME = JSON.stringify({ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' });
const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
const ON = JSON.stringify({ guestPhotos: { enabled: true } });
const SECRET = 'jwt-secret';

let db, r2;
const x = (s, ...a) => db.exec.prepare(s).run(...a);
const q = (s, ...a) => db.exec.prepare(s).all(...a).map((r) => ({ ...r }));
const inv = (id, tier, extras, status = 'live') => x(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier, extras)
  VALUES (?, 1, ?, ?, '{"partner1":"Maria","partner2":"Juan","eventDate":"2099-06-12"}', '[]', ?, '2099-06-12', ?, ?, ?)`, id, `s-${id}`, SCHEME, status, hash(`mt-${id}`), tier, extras);
beforeEach(() => {
  db = makeD1(); r2 = makeR2();
  x(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type) VALUES (1, 'classic', 'Classic', 'classic', 99900, '[${SCHEME}]', 1, 0, 'wedding_invitation')`);
  inv(1, 'premium', ON); inv(2, 'standard', '{}'); inv(3, 'premium', '{}'); inv(4, 'premium', ON, 'pending'); inv(5, 'premium', ON);
  x("INSERT INTO invitation_guests (id, invitation_id, name, seats, token) VALUES (7, 1, 'Tita Linda', 2, 'gtok')");
  const h = bcrypt.hashSync('pw-pw-pw-pw', 4);
  for (const [email, role] of [['adm@jlc.test', 'Administrator'], ['des@jlc.test', 'Editor']])
    x("INSERT INTO admins (email, fullName, role, status, verified, passwordHash, createdAt) VALUES (?, ?, ?, 'Active', 1, ?, 't')", email, role, role, h);
});

const call = (method, path, body, headers = {}, ip = '1.2.3.4') => invitations({
  request: new Request('https://shop.test' + path, { method, headers: { 'CF-Connecting-IP': ip, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret' }, waitUntil() {},
});
const upload = (slug, body, ip) => call('POST', `/api/invitations/i/${slug}/photos`, { name: 'Ana', photos: [PNG], turnstileToken: 'good-token', ...body }, {}, ip);
const M = (id) => ({ 'X-Manage-Token': `mt-${id}` });
const moderate = (body, id = 1) => call('POST', '/api/invitations/manage/guest-photos', body, M(id));
const asAdmin = async (method, path, body, email = 'adm@jlc.test') => admin({
  request: new Request('https://shop.test/api/admin/invitations' + path, { method, headers: { Authorization: 'Bearer ' + await signAdminToken(email, SECRET) }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env: { DB: db, PHOTOS: r2, JWT_SECRET: SECRET }, params: {}, waitUntil() {},
});
const photo = (key) => photoRoute({ request: new Request('https://shop.test/photos/' + key), env: { DB: db, PHOTOS: r2 } });
const guestApi = async (slug) => (await call('GET', `/api/invitations/i/${slug}`)).json();
const media = (id = 1) => q("SELECT id, r2_key, guest_name, guest_id, status FROM invitation_media WHERE invitation_id = ? AND kind = 'guest' ORDER BY id", id);

test('an upload is stored pending under a random guest key, and pending photos are never public', async () => {
  const res = await upload('s-1', { photos: [PNG, PNG] });
  assert.deepEqual(await res.json(), { saved: 2 });
  const rows = media();
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.match(r.r2_key, /^inv\/1\/guest-\d+-[a-z0-9]{6}\.png$/);
    assert.equal(r.status, 'pending');
    assert.equal(r.guest_name, 'Ana');
    assert.ok(r2.map.has(r.r2_key));
    assert.equal((await photo(r.r2_key)).status, 404);
  }
  assert.deepEqual((await guestApi('s-1')).guestPhotos, []);
  // approved: public and listed, newest first
  for (const r of rows) assert.equal((await moderate({ action: 'approve', id: r.id })).status, 200);
  assert.equal((await photo(rows[0].r2_key)).status, 200);
  assert.deepEqual((await guestApi('s-1')).guestPhotos, rows.map((r) => `/photos/${r.r2_key}`).reverse());
  // rejected again: gone from both
  await moderate({ action: 'reject', id: rows[0].id });
  assert.equal((await photo(rows[0].r2_key)).status, 404);
  assert.deepEqual((await guestApi('s-1')).guestPhotos, [`/photos/${rows[1].r2_key}`]);
});

test('the guest API has no guestPhotos when the feature is off or the invitation is Standard', async () => {
  assert.equal('guestPhotos' in await guestApi('s-3'), false);
  assert.equal('guestPhotos' in await guestApi('s-2'), false);
});

test('a guest link forces the uploader name and links the guest', async () => {
  assert.equal((await upload('s-1', { name: 'Someone else', guestToken: 'gtok' })).status, 200);
  assert.deepEqual(media().map((r) => [r.guest_name, r.guest_id]), [['Tita Linda', 7]]);
});

test('Standard cannot enable guest photos or upload; off, non-live and unknown invitations refuse', async () => {
  const en = await call('POST', '/api/invitations/manage/extras', { extras: { guestPhotos: { enabled: true } } }, M(2));
  assert.equal(en.status, 400);
  x("UPDATE invitations SET extras = ? WHERE id = 2", ON); // even if the setting were stored somehow
  assert.equal((await upload('s-2')).status, 403);
  assert.equal((await upload('s-3')).status, 403);
  assert.equal((await upload('s-4')).status, 404);
  assert.equal((await upload('nope')).status, 404);
  assert.equal(q('SELECT COUNT(*) AS n FROM invitation_media')[0].n, 0);
  assert.equal(r2.map.size, 0);
});

test('validation: 1 to 5 photos, images only, a name of up to 60 characters, and Turnstile', async () => {
  for (const body of [{ photos: [] }, { photos: Array(6).fill(PNG) }, { photos: ['data:text/html;base64,AAAA'] }, { photos: 'x' }, { name: '' }, { name: 'x'.repeat(61) }])
    assert.equal((await upload('s-1', body)).status, 400, JSON.stringify(body).slice(0, 60));
  assert.equal((await upload('s-1', { turnstileToken: 'bad' })).status, 400);
  assert.equal((await upload('s-1', { turnstileToken: undefined })).status, 400);
  assert.equal((await upload('s-1', { photos: Array(5).fill(PNG) })).status, 200);
  assert.equal(media().length, 5);
});

test('20 uploads per IP per hour', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await upload('s-1', {}, '9.9.9.9')).status, 200);
  assert.equal((await upload('s-1', {}, '9.9.9.9')).status, 429);
  assert.equal((await upload('s-1', {}, '8.8.8.8')).status, 200);
});

test('the 500 cap: an upload stops when full and reports what was saved, leaving no stray objects', async () => {
  for (let i = 0; i < 499; i++) x("INSERT INTO invitation_media (invitation_id, kind, r2_key, status) VALUES (1, 'guest', ?, 'pending')", `inv/1/old-${i}.jpg`);
  assert.deepEqual(await (await upload('s-1', { photos: [PNG, PNG, PNG] })).json(), { saved: 1, full: true });
  assert.equal(media().length, 500);
  assert.equal(r2.map.size, 1);
  assert.deepEqual(await (await upload('s-1')).json(), { saved: 0, full: true });
  assert.equal(r2.map.size, 1);
});

test('organiser moderation: list with counts, approve all, delete removes the row then the object; foreign ids are 404', async () => {
  await upload('s-1', { photos: [PNG, PNG, PNG] });
  await upload('s-5', {}, '5.5.5.5');
  const [a, b, c] = media();
  const [foreign] = media(5);
  await moderate({ action: 'reject', id: c.id });
  const list = await (await call('GET', '/api/invitations/manage/guest-photos', undefined, M(1))).json();
  assert.deepEqual(list.counts, { pending: 2, approved: 0, rejected: 1 });
  assert.equal(list.photos[0].guestName, 'Ana');
  assert.deepEqual(await (await moderate({ action: 'approve-all' })).json(), { ok: true, approved: 2 });
  assert.deepEqual(media().map((r) => r.status), ['approved', 'approved', 'rejected']);
  assert.equal((await moderate({ action: 'delete', id: a.id })).status, 200);
  assert.equal(r2.map.has(a.r2_key), false);
  assert.equal(media().length, 2);
  for (const action of ['approve', 'reject', 'delete']) assert.equal((await moderate({ action, id: foreign.id })).status, 404);
  assert.equal((await moderate({ action: 'approve', id: 'x' })).status, 404);
  assert.equal((await moderate({ action: 'nope', id: b.id })).status, 400);
  assert.equal(media(5)[0].status, 'pending');
  assert.ok(r2.map.has(foreign.r2_key));
  // approve-all touches only this invitation
  assert.equal((await moderate({ action: 'approve-all' }, 1)).status, 200);
  assert.equal(media(5)[0].status, 'pending');
  assert.equal((await call('GET', '/api/invitations/manage/guest-photos')).status, 404);
});

test('the organiser preview streams pending photos privately, only for their own invitation', async () => {
  await upload('s-1');
  await upload('s-5', {}, '5.5.5.5');
  const [mine] = media();
  const [theirs] = media(5);
  const res = await call('GET', `/api/invitations/manage/media/${mine.id}`, undefined, M(1));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.equal((await call('GET', `/api/invitations/manage/media/${theirs.id}`, undefined, M(1))).status, 404);
  assert.equal((await call('GET', `/api/invitations/manage/media/${mine.id}`)).status, 404);
});

test('shop admin: the Event features panel, moderation and preview; foreign ids are 404 and Designers are refused', async () => {
  x("UPDATE invitations SET extras = ? WHERE id = 1", JSON.stringify({ guestPhotos: { enabled: true }, gallery: { layout: 'carousel' }, booth: { enabled: true } }));
  x("INSERT INTO gift_items (invitation_id, name, reserved_name, reserved_at) VALUES (1, 'Mixer', 'Ana', '2026-11-18T01:00:00Z'), (1, 'Toaster', NULL, NULL)");
  x("UPDATE invitation_guests SET checked_in_at = 't', checked_in_count = 2 WHERE id = 7");
  await upload('s-1', { photos: [PNG, PNG] });
  await upload('s-5', {}, '5.5.5.5');
  const [a, b] = media();
  const [foreign] = media(5);
  const f = await (await asAdmin('GET', '/invitations/1/features')).json();
  assert.deepEqual(f.inUse, { attire: false, galleryLayout: 'carousel', giftItems: 2, giftMethods: 0, guestPhotos: true, booth: true, checkin: false });
  assert.deepEqual(f.checkin, { guests: 1, checkedIn: 1, people: 2 });
  assert.deepEqual(f.reservations, [{ item: 'Mixer', name: 'Ana', at: '2026-11-18T01:00:00Z' }]);
  assert.equal(f.photos.length, 2);
  assert.equal((await asAdmin('GET', `/invitations/1/media/${a.id}`)).status, 200);
  assert.equal((await asAdmin('GET', `/invitations/1/media/${foreign.id}`)).status, 404);
  assert.equal((await asAdmin('POST', '/invitations/1/guest-photos', { action: 'approve', id: a.id })).status, 200);
  assert.equal((await asAdmin('POST', '/invitations/1/guest-photos', { action: 'delete', id: b.id })).status, 200);
  assert.equal(r2.map.has(b.r2_key), false);
  assert.equal((await asAdmin('POST', '/invitations/1/guest-photos', { action: 'delete', id: foreign.id })).status, 404);
  assert.ok(r2.map.has(foreign.r2_key));
  assert.deepEqual(media().map((r) => r.status), ['approved']);
  assert.equal((await asAdmin('GET', '/invitations/999/features')).status, 404);
  assert.equal((await asAdmin('GET', '/invitations/1/features', undefined, 'des@jlc.test')).status, 403);
  assert.equal((await asAdmin('POST', '/invitations/1/guest-photos', { action: 'approve-all' }, 'des@jlc.test')).status, 403);
});

test('purge deletes guest media rows and objects', async () => {
  await upload('s-1', { photos: [PNG, PNG] });
  const keys = media().map((r) => r.r2_key);
  x("UPDATE invitations SET event_date = '2020-01-01' WHERE id = 1");
  await runCleanup(db, r2, new Date('2026-11-18T00:00:00Z'));
  assert.equal(media().length, 0);
  for (const k of keys) assert.equal(r2.map.has(k), false);
});
