// Customer-uploaded music: upload, replace and remove, the guest API, Range through /photos, and the style rule.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequestGet: photoRoute } = await bundle('functions/photos/[[key]].ts', 'photo.mjs');
const { onRequestGet: mediaRoute } = await bundle('functions/media/[[key]].ts', 'media.mjs');

const hash = (s) => createHash('sha256').update(s).digest('hex');
const SCHEMES = JSON.stringify([{ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' }]);
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2099-06-12', ceremony: { name: 'St. Joseph' } };
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(997, 7)]);
const M4A = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(992, 7)]);

let db, r2;
beforeEach(() => {
  db = makeD1(); r2 = makeR2();
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type) VALUES (1, 'd', 'D', 'classic', 99900, '${SCHEMES}', 1, 0, 'wedding_invitation')`);
  for (const [id, tok, tier] of [[1, 'tok', 'premium'], [2, 'other', 'premium'], [3, 'std', 'standard']]) {
    db.exec.prepare('INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier) VALUES (?, 1, ?, ?, ?, \'[]\', \'live\', \'2099-06-12\', ?, ?)')
      .run(id, 'maria-' + id, JSON.stringify(JSON.parse(SCHEMES)[0]), JSON.stringify(details), hash(tok), tier);
  }
});
const ctx = (request) => ({ request, env: { DB: db, PHOTOS: r2 }, waitUntil() {} });
const upload = (body, { token = 'tok', type = 'audio/mpeg', rights = 'yes', title, len } = {}) => invitations(ctx(new Request('https://shop.test/api/invitations/manage/music', {
  method: 'POST', body, headers: { 'X-Manage-Token': token, 'Content-Type': type, ...(rights && { 'X-Music-Rights': rights }), ...(title && { 'X-Music-Title': title }), 'Content-Length': String(len ?? body.length) } })));
const call = (method, path, body, token = 'tok') => invitations(ctx(new Request('https://shop.test' + path, { method, body: body && JSON.stringify(body), headers: { 'X-Manage-Token': token } })));
const row = (id = 1) => db.exec.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
const edit = (style) => call('POST', '/api/invitations/manage', { details, photos: [], style });
const photo = (key, range) => photoRoute({ request: new Request('https://shop.test/photos/' + key, { headers: range ? { Range: range } : {} }), env: { DB: db, PHOTOS: r2 } });

test('MP3 and M4A upload store the object with the right type and title', async () => {
  let res = await upload(MP3, { title: encodeURIComponent('Our Song ♥ ') });
  assert.equal(res.status, 200);
  let { music } = await res.json();
  assert.match(music.key, /^inv\/1\/music-\d+\.mp3$/);
  assert.equal(music.title, 'Our Song ♥');
  assert.equal(r2.map.get(music.key).httpMetadata.contentType, 'audio/mpeg');
  assert.deepEqual([row().music_key, row().music_title], [music.key, music.title]);
  res = await upload(M4A, { type: 'audio/x-m4a' });
  ({ music } = await res.json());
  assert.match(music.key, /\.m4a$/);
  assert.equal(r2.map.get(music.key).httpMetadata.contentType, 'audio/mp4');
  assert.equal(music.title, 'Our song');
});

test('rejects non-audio bytes, too large, missing rights and a bad title', async () => {
  assert.equal((await upload(Buffer.from('not audio at all'))).status, 400);
  assert.equal((await upload(Buffer.from('xxxx'), { type: 'text/plain' })).status, 400);
  assert.equal((await upload(Buffer.concat([MP3, Buffer.alloc(8_000_000)]))).status, 400);
  const noRights = await upload(MP3, { rights: '' });
  assert.equal(noRights.status, 400);
  assert.equal((await noRights.json()).error, 'Please confirm you have the right to use this music.');
  assert.equal((await upload(MP3, { title: 'x'.repeat(81) })).status, 400);
  assert.equal(row().music_key, null);
  assert.equal(r2.map.size, 0);
});

test('Standard gets 403 and another customer gets 404', async () => {
  const std = await upload(MP3, { token: 'std' });
  assert.equal(std.status, 403);
  assert.equal((await std.json()).error, 'Your own music is a Premium feature.');
  assert.equal((await upload(MP3, { token: 'nobody' })).status, 404);
  assert.equal(r2.map.size, 0);
});

test('style custom is rejected without an upload and accepted after', async () => {
  assert.equal((await edit({ music: 'custom' })).status, 400);
  await upload(MP3);
  assert.equal((await edit({ music: 'custom' })).status, 200);
  assert.deepEqual(JSON.parse(row().style), { music: 'custom' });
  const manage = await call('GET', '/api/invitations/manage').then((r) => r.json());
  assert.equal(manage.customMusic.key, row().music_key);
});

test('guest API returns the custom music and /photos serves it with Range only while live', async () => {
  const { music } = await (await upload(MP3, { title: 'Ours' })).json();
  await edit({ music: 'custom' });
  const g = await invitations(ctx(new Request('https://shop.test/api/invitations/i/maria-1'))).then((r) => r.json());
  assert.deepEqual(g.music, { url: '/photos/' + music.key, title: 'Ours', credit: '' });
  const full = await photo(music.key);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Content-Type'), 'audio/mpeg');
  const part = await photo(music.key, 'bytes=0-9');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 0-9/1000');
  assert.equal((await photo(music.key, 'bytes=-10')).headers.get('Content-Range'), 'bytes 990-999/1000');
  assert.equal((await photo(music.key, 'bytes=5000-')).status, 416);
  assert.equal((await photo('inv/2/music-1.mp3')).status, 404);
  db.exec.exec("UPDATE invitations SET status = 'expired'");
  assert.equal((await photo(music.key)).status, 404);
});

test('replace deletes the old object; remove clears columns, object and style', async () => {
  const a = (await (await upload(MP3)).json()).music.key;
  await new Promise((r) => setTimeout(r, 3));
  const b = (await (await upload(M4A)).json()).music.key;
  assert.equal(r2.map.has(a), false);
  assert.equal(r2.map.has(b), true);
  await edit({ music: 'custom' });
  const res = await call('POST', '/api/invitations/manage/music/remove');
  assert.deepEqual(await res.json(), { ok: true });
  assert.deepEqual([row().music_key, row().music_title, row().style], [null, null, '{}']);
  assert.equal(r2.map.has(b), false);
});

test('the media route still serves Range through the shared helper', async () => {
  r2.map.set('media/music/1-abcdefgh.mp3', { body: 'x', bytes: MP3, httpMetadata: { contentType: 'audio/mpeg' } });
  const get = (range) => mediaRoute({ request: new Request('https://shop.test/media/music/1-abcdefgh.mp3', { headers: range ? { Range: range } : {} }), env: { PHOTOS: r2 } });
  const part = await get('bytes=2-5');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 2-5/1000');
  assert.equal((await get('bytes=9999-')).status, 416);
  assert.equal((await get()).headers.get('Accept-Ranges'), 'bytes');
});
