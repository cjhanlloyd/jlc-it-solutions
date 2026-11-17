// Premium tier gates: checkout, manage edit, guest API, expiry and cleanup, enforced on the server.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequestGet: photoRoute } = await bundle('functions/photos/[[key]].ts', 'photo.mjs');
const { runCleanup } = await bundle('server/cleanup.ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: new URLSearchParams(init.body).get('response') === 'good-token' });
  throw new Error('Unexpected fetch ' + url);
};

const hash = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'tok';
const SCHEMES = JSON.stringify([{ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' }]);
const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2099-06-12', ceremony: { name: 'St. Joseph' } };
const pkgs = (tier) => JSON.stringify([{ key: 'main', name: tier, priceCentavos: 99900, inclusions: [], kind: 'template', ...(tier === 'premium' && { tier }) }]);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

let db, r2;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  db.exec.exec(`
    INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type, packages) VALUES
      (1, 'std', 'Std', 'classic', 99900, '${SCHEMES}', 1, 0, 'wedding_invitation', '${pkgs('standard')}'),
      (2, 'prem', 'Prem', 'classic', 99900, '${SCHEMES}', 1, 0, 'wedding_invitation', '${pkgs('premium')}');
    INSERT INTO music_tracks (id, title, credit, r2_key, active) VALUES (1, 'Song', 'By Me', 'media/music/a.mp3', 1);
    UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '0917', qr_key = 'settings/qr.png';`);
});
const ctx = (request) => ({ request, env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 's' }, waitUntil() {} });
const call = (method, path, body, token) => invitations(ctx(new Request('https://shop.test' + path, {
  method, body: body === undefined ? undefined : JSON.stringify(body), headers: token ? { 'X-Manage-Token': token } : {} })));
const checkout = (design, extra = {}) => call('POST', '/api/invitations/checkout', {
  designSlug: design, colorScheme: 'Blush', email: 'a@b.com', name: 'Maria', termsAccepted: true, turnstileToken: 'good-token', details, photos: [PNG], ...extra });
const q = (s, ...a) => db.exec.prepare(s).all(...a);
const count = (t) => q(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;
const photo = () => photoRoute({ request: new Request('https://shop.test/photos/inv/1/0.png'), env: { DB: db, PHOTOS: r2 } });
const guest = () => call('GET', '/api/invitations/i/maria-1');

test('Standard checkout rejects music, intro and 7 photos, creating nothing', async () => {
  for (const extra of [{ style: { music: 1 } }, { style: { intro: true } }, { photos: Array(7).fill(PNG) }]) {
    assert.equal((await checkout('std', extra)).status, 400);
  }
  assert.equal(count('invitations') + count('orders'), 0);
});

test('Premium checkout accepts 12 photos, music and intro:false and stores the tier', async () => {
  const res = await checkout('prem', { photos: Array(12).fill(PNG), style: { music: 1, intro: false } });
  assert.equal(res.status, 200);
  const i = q('SELECT * FROM invitations')[0];
  assert.equal(i.tier, 'premium');
  assert.deepEqual(JSON.parse(i.style), { music: 1, intro: false });
  assert.equal(JSON.parse(i.photos).length, 12);
  assert.equal((await checkout('prem', { photos: Array(13).fill(PNG) })).status, 400);
});

test('the client cannot raise the tier', async () => {
  assert.equal((await checkout('std', { tier: 'premium', style: { music: 1 } })).status, 400);
  assert.equal((await checkout('std', { tier: 'premium', packageKey: 'main' })).status, 200);
  assert.equal(q('SELECT tier FROM invitations')[0].tier, 'standard');
});

function seedLive(tier, { eventDate = details.eventDate, style = '{}' } = {}) {
  db.exec.prepare(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier, style)
    VALUES (1, 1, 'maria-1', ?, ?, '["inv/1/0.png"]', 'live', ?, ?, ?, ?)`)
    .run(JSON.stringify(JSON.parse(SCHEMES)[0]), JSON.stringify({ ...details, eventDate }), eventDate, hash(TOKEN), tier, style);
  r2.map.set('inv/1/0.png', { body: 'x', bytes: Buffer.from('x'), httpMetadata: { contentType: 'image/png' } });
}
const edit = (extra) => call('POST', '/api/invitations/manage', { details, photos: ['inv/1/0.png'], ...extra }, TOKEN);

test('manage edit: Standard rejects music and 7 photos; Premium accepts them', async () => {
  seedLive('standard');
  assert.equal((await edit({ style: { music: 1 } })).status, 400);
  assert.equal((await edit({ photos: Array(7).fill(PNG) })).status, 400);
  db.exec.exec("UPDATE invitations SET tier = 'premium'");
  assert.equal((await edit({ style: { music: 1 } })).status, 200);
  assert.equal((await edit({ photos: Array(12).fill(PNG) })).status, 200);
});

test('guest API: music object for an active track, null once deactivated or deleted', async () => {
  seedLive('premium', { style: '{"music":1}' });
  const get = async () => { const r = await guest(); assert.equal(r.status, 200); return r.json(); };
  let g = await get();
  assert.deepEqual([g.tier, g.intro, g.music], ['premium', true, { url: '/media/music/a.mp3', title: 'Song', credit: 'By Me' }]);
  db.exec.exec('UPDATE music_tracks SET active = 0');
  assert.equal((await get()).music, null);
  db.exec.exec('DELETE FROM music_tracks');
  assert.equal((await get()).music, null);
  db.exec.exec("UPDATE invitations SET tier = 'standard'");
  g = await get();
  assert.deepEqual([g.tier, g.intro, g.music], ['standard', false, null]);
});

test('expiry: 100 days after the event Premium is live, Standard is expired and purged', async () => {
  seedLive('premium', { eventDate: daysAgo(100) });
  assert.equal((await guest().then((r) => r.json())).state, 'live');
  assert.equal((await photo()).status, 200);
  await runCleanup(db, r2, new Date());
  assert.equal(q('SELECT status FROM invitations')[0].status, 'live');

  db.exec.exec("UPDATE invitations SET tier = 'standard'");
  assert.equal((await photo()).status, 404);
  assert.equal((await guest().then((r) => r.json())).state, 'expired');
  db.exec.exec("UPDATE invitations SET status = 'live'");
  await runCleanup(db, r2, new Date());
  assert.equal(q('SELECT photos FROM invitations')[0].photos, '[]');
});
