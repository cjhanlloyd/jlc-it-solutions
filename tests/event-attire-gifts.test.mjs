// Attire photos, extras, the wish list and guest reservations. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) {
    const form = new URLSearchParams(init.body);
    return Response.json({ success: form.get('secret') === 'turnstile-secret' && form.get('response') === 'good-token' });
  }
  throw new Error('Unexpected fetch ' + url);
};

const hash = (s) => createHash('sha256').update(s).digest('hex');
const SCHEME = JSON.stringify({ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' });
const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } };

let db, r2;
beforeEach(() => {
  db = makeD1(); r2 = makeR2();
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type)
    VALUES (1, 'classic', 'Classic', 'classic', 99900, '[${SCHEME}]', 1, 0, 'wedding_invitation');`);
  inv(1, 'premium'); inv(2, 'standard');
  db.exec.exec("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier) VALUES (3, 1, 'maria-3', '{}', '{}', '[]', 'pending', '2027-06-12', 'x3', 'premium')");
});
const inv = (id, tier) => db.exec.prepare(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier)
  VALUES (?, 1, ?, ?, ?, '[]', 'live', '2027-06-12', ?, ?)`).run(id, `maria-${id}`, SCHEME, JSON.stringify(details), hash(`mt-${id}`), tier);
const q = (s, ...a) => db.exec.prepare(s).all(...a).map((r) => ({ ...r }));
const call = (method, path, body, headers = {}) => invitations({
  request: new Request('https://shop.test' + path, { method, headers: { 'CF-Connecting-IP': '1.2.3.4', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret' }, waitUntil() {},
});
const M1 = { 'X-Manage-Token': 'mt-1' };
const M2 = { 'X-Manage-Token': 'mt-2' };
const manage = (path, body, h = M1) => call('POST', '/api/invitations/manage' + path, body, h);
const gifts = (body, h = M1) => manage('/gifts', body, h);
const addGift = async (name = 'Blender', extra = {}) => (await (await gifts({ action: 'add', name, ...extra })).json());
const view = async (slug, g) => (await call('GET', `/api/invitations/i/${slug}` + (g ? `?g=${g}` : ''))).json();
const reserve = (body, slug = 'maria-1') => call('POST', `/api/invitations/i/${slug}/gifts/reserve`, { turnstileToken: 'good-token', ...body });
const release = (body, slug = 'maria-1') => call('POST', `/api/invitations/i/${slug}/gifts/release`, body);
const addGuest = async (name) => (await (await call('POST', '/api/invitations/manage/guests', { action: 'add', name, seats: 2 }, M1)).json());

test('extras save, return in manage GET, and a Standard invitation cannot set Premium keys', async () => {
  const extras = { attire: { motif: 'Garden', palette: ['#D8A7B1'], notes: 'Light colours' }, gifts: { methods: [{ label: 'GCash', accountNumber: '0917' }] } };
  const res = await manage('/extras', { extras });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).extras.attire.palette, ['#d8a7b1']);
  assert.equal((await (await call('GET', '/api/invitations/manage', undefined, M1)).json()).extras.attire.motif, 'Garden');
  assert.equal((await manage('/extras', { extras: { booth: { enabled: true } } }, M2)).status, 400);
  assert.equal((await manage('/extras', { extras: { attire: { palette: ['red'] } } })).status, 400);
  assert.equal((await manage('/extras', { extras }, {})).status, 404);
});

test('attire photo: upload, caption update, limit of 6, delete, and a foreign id', async () => {
  const up = async (h = M1, caption = 'Barong') => manage('/attire', { photo: PNG, caption }, h);
  const first = await (await up()).json();
  assert.match(first.photo.key, /^inv\/1\/attire-\d+-[a-z0-9]{6}\.png$/);
  assert.equal(q('SELECT status, kind FROM invitation_media WHERE id = ?', first.photo.id)[0].status, 'approved');
  assert.ok(await r2.get(first.photo.key));
  assert.equal((await manage('/attire', { photo: 'data:text/html;base64,AAAA' })).status, 400);
  assert.equal((await manage('/attire', { photo: PNG, caption: 'x'.repeat(81) })).status, 400);
  assert.equal((await manage('/attire/update', { id: first.photo.id, caption: 'Terno' })).status, 200);
  const list = await (await call('GET', '/api/invitations/manage', undefined, M1)).json();
  assert.deepEqual(list.attirePhotos, [{ id: first.photo.id, key: first.photo.key, caption: 'Terno' }]);

  for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 2)); assert.equal((await up()).status, 200); }
  await new Promise((r) => setTimeout(r, 2));
  const over = await up();
  assert.equal(over.status, 400);
  assert.equal(q("SELECT COUNT(*) AS n FROM invitation_media WHERE kind = 'attire'")[0].n, 6);
  assert.equal(r2.map.size, 6, 'the rejected upload left no object behind');

  assert.equal((await manage('/attire/delete', { id: first.photo.id }, M2)).status, 404);
  assert.equal((await manage('/attire/update', { id: first.photo.id, caption: 'x' }, M2)).status, 404);
  assert.equal((await manage('/attire/delete', { id: first.photo.id })).status, 200);
  assert.equal(q('SELECT * FROM invitation_media WHERE id = ?', first.photo.id).length, 0);
  assert.equal(await r2.get(first.photo.key), null);
});

test('non-live invitations get no media', async () => {
  const res = await call('POST', '/api/invitations/manage/attire', { photo: PNG }, { 'X-Manage-Token': 'x3' });
  assert.equal(res.status, 404);
  assert.equal(q('SELECT * FROM invitation_media').length, 0);
});

test('gift CRUD, validation, limit of 50 and reorder', async () => {
  const a = await addGift('Blender', { note: 'Red', link: 'https://shop.example/blender', priceCentavos: 250000 });
  const b = await addGift('Kettle');
  assert.ok(a.id && b.id);
  for (const bad of [{ name: '' }, { name: 'x'.repeat(81) }, { name: 'A', note: 'n'.repeat(201) }, { name: 'A', link: 'http://insecure.example' },
    { name: 'A', link: 'javascript:alert(1)' }, { name: 'A', priceCentavos: 99 }, { name: 'A', priceCentavos: 10_000_001 }, { name: 'A', priceCentavos: 1.5 }]) {
    assert.equal((await gifts({ action: 'add', ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal((await gifts({ action: 'update', id: a.id, name: 'Blender X', note: '', link: '', priceCentavos: null })).status, 200);
  assert.equal((await gifts({ action: 'update', id: a.id, name: 'Nope' }, M2)).status, 404);
  assert.equal((await gifts({ action: 'reorder', ids: [b.id, a.id] })).status, 200);
  const list = (await (await call('GET', '/api/invitations/manage', undefined, M1)).json()).giftItems;
  assert.deepEqual(list.map((g) => g.name), ['Kettle', 'Blender X']);
  assert.equal(list[1].link, null);
  assert.equal((await gifts({ action: 'reorder', ids: [a.id] })).status, 400);
  assert.equal((await gifts({ action: 'delete', id: a.id }, M2)).status, 404);
  assert.equal((await gifts({ action: 'delete', id: a.id })).status, 200);
  assert.equal((await gifts({ action: 'bogus' })).status, 400);
  for (let i = 0; i < 49; i++) assert.equal((await gifts({ action: 'add', name: `g${i}` })).status, 200);
  assert.equal((await gifts({ action: 'add', name: 'one too many' })).status, 400);
  assert.equal(q('SELECT COUNT(*) AS n FROM gift_items WHERE invitation_id = 1')[0].n, 50);
});

test('the guest API shows the reserved flag but never the name, and reservedByYou only to that guest', async () => {
  const item = await addGift('Blender');
  await manage('/extras', { extras: { attire: { motif: 'Garden' }, booth: { enabled: true }, checkin: { enabled: true } } });
  const g1 = await addGuest('Bea');
  const g2 = await addGuest('Cy');
  assert.equal((await reserve({ itemId: item.id, guestToken: g1.token })).status, 200);
  for (const [token, mine] of [[undefined, false], [g2.token, false], [g1.token, true]]) {
    const body = await view('maria-1', token);
    assert.equal(body.giftItems[0].reserved, true);
    assert.equal(!!body.giftItems[0].reservedByYou, mine);
    assert.ok(!JSON.stringify(body).includes('Bea') || token === g1.token, 'name appears only as the guest greeting');
    assert.ok(!('reservedName' in body.giftItems[0]) && !('reserved_name' in body.giftItems[0]));
  }
  const pub = await view('maria-1');
  assert.deepEqual(pub.extras, { attire: { motif: 'Garden' }, booth: { enabled: true }, checkin: { enabled: true } });
  assert.deepEqual(pub.attirePhotos, []);
  const org = (await (await call('GET', '/api/invitations/manage', undefined, M1)).json()).giftItems[0];
  assert.equal(org.reservedName, 'Bea');
});

test('empty extras: the new guest fields are present and empty', async () => {
  const body = await view('maria-2');
  assert.deepEqual([body.extras, body.attirePhotos, body.giftItems], [{}, [], []]);
});

test('two parallel reservations: one wins, the other gets 409', async () => {
  const item = await addGift();
  const [a, b] = await Promise.all([reserve({ itemId: item.id, name: 'Ana' }), reserve({ itemId: item.id, name: 'Ben' })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await (a.status === 409 ? a : b).json()).error, 'Someone already chose this gift.');
  assert.equal(q('SELECT reserved_name FROM gift_items')[0].reserved_name, a.status === 200 ? 'Ana' : 'Ben');
});

test('a guest link forces the guest name; release only by the reserving guest link or the organiser', async () => {
  const item = await addGift();
  const g1 = await addGuest('Bea'); const g2 = await addGuest('Cy');
  assert.equal((await reserve({ itemId: item.id, guestToken: g1.token, name: 'Someone Else' })).status, 200);
  assert.deepEqual(q('SELECT reserved_name, reserved_guest_id FROM gift_items')[0], { reserved_name: 'Bea', reserved_guest_id: g1.id });
  assert.equal((await release({ itemId: item.id })).status, 403);
  assert.equal((await release({ itemId: item.id, guestToken: g2.token })).status, 403);
  assert.equal((await release({ itemId: item.id, guestToken: g1.token })).status, 200);
  assert.equal(q('SELECT reserved_at FROM gift_items')[0].reserved_at, null);
  // anonymous reservation can be released by the organiser only
  assert.equal((await reserve({ itemId: item.id, name: 'Walk-in' })).status, 200);
  assert.equal((await release({ itemId: item.id, guestToken: g1.token })).status, 403);
  assert.equal((await gifts({ action: 'release', id: item.id })).status, 200);
  assert.equal(q('SELECT reserved_name FROM gift_items')[0].reserved_name, null);
});

test('reserve checks Turnstile, the name, the rate limit, the invitation and the item', async () => {
  const item = await addGift();
  assert.equal((await reserve({ itemId: item.id, name: 'Ana', turnstileToken: 'bad' })).status, 400);
  assert.equal((await reserve({ itemId: item.id, name: '' })).status, 400);
  assert.equal((await reserve({ itemId: item.id, name: 'Ana' }, 'nope')).status, 404);
  assert.equal((await reserve({ itemId: item.id, name: 'Ana' }, 'maria-2')).status, 404, 'item of another invitation');
  assert.equal((await reserve({ itemId: item.id, name: 'Ana' }, 'maria-3')).status, 404, 'not live');
  assert.equal((await reserve({ itemId: 999, name: 'Ana' })).status, 404);
  const now = new Date().toISOString();
  for (let i = 0; i < 20; i++) db.exec.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'gift_reserve', 'Gift reservation from 1.2.3.4')").run(now);
  assert.equal((await reserve({ itemId: item.id, name: 'Ana' })).status, 429);
});

test('checkout accepts attire extras, stores them, and rejects bad or Premium-only ones', async () => {
  db.exec.exec("UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '0917', qr_key = 'settings/qr.png'");
  const body = (extras) => ({ designSlug: 'classic', colorScheme: 'Blush', email: 'b@example.com', name: 'Maria', termsAccepted: true, turnstileToken: 'good-token', details, photos: [PNG], extras });
  const post = (b) => call('POST', '/api/invitations/checkout', b);
  const ok = await post(body({ attire: { motif: 'Garden', palette: ['#d8a7b1'], notes: 'Formal' } }));
  assert.equal(ok.status, 200);
  const row = q('SELECT extras FROM invitations ORDER BY id DESC LIMIT 1')[0];
  assert.deepEqual(JSON.parse(row.extras), { attire: { motif: 'Garden', palette: ['#d8a7b1'], notes: 'Formal' } });
  assert.equal((await post(body({ attire: { palette: ['nope'] } }))).status, 400);
  assert.equal((await post(body({ booth: { enabled: true } }))).status, 400);
  assert.equal((await post(body({ unknown: {} }))).status, 400);
});

test('a Standard invitation with stale Premium extras shows guests none of them, and the organiser can still save', async () => {
  const stale = { guestPhotos: { enabled: true }, booth: { enabled: true }, checkin: { enabled: true }, attire: { motif: 'Garden' } };
  db.exec.prepare('UPDATE invitations SET extras = ? WHERE id = 2').run(JSON.stringify(stale));
  const guest = await view('maria-2');
  assert.deepEqual(guest.extras, { attire: { motif: 'Garden' } });
  // The organiser GET hides them, so a client resending the whole object still saves
  const m = await (await call('GET', '/api/invitations/manage', undefined, M2)).json();
  assert.equal(m.extras.booth, undefined);
  let res = await manage('/extras', { extras: { ...m.extras, gallery: { layout: 'masonry' } } }, M2);
  assert.equal(res.status, 200);
  // Resending the stored stale keys unchanged is tolerated and dropped; a new Premium key is still rejected
  db.exec.prepare('UPDATE invitations SET extras = ? WHERE id = 2').run(JSON.stringify(stale));
  res = await manage('/extras', { extras: { ...stale, gallery: { layout: 'grid' } } }, M2);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(JSON.parse(q('SELECT extras FROM invitations WHERE id = 2')[0].extras)).sort(), ['attire', 'gallery']);
  res = await manage('/extras', { extras: { booth: { enabled: true } } }, M2);
  assert.equal(res.status, 400);
});

test('two attire uploads in the same millisecond keep both objects', async () => {
  const realNow = Date.now; Date.now = () => 1_700_000_000_000;
  try {
    const a = await (await manage('/attire', { photo: PNG })).json();
    const b = await (await manage('/attire', { photo: PNG })).json();
    assert.notEqual(a.photo.key, b.photo.key);
    assert.ok(r2.map.has(a.photo.key) && r2.map.has(b.photo.key));
  } finally { Date.now = realNow; }
});
