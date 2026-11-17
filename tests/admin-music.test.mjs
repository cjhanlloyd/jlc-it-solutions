// Admin music library API, the public track list and the /media route for mp3, on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: musicFn } = await bundle('functions/api/admin/music/[[path]].ts');
const { onRequest: publicFn } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequestGet: mediaFn } = await bundle('functions/media/[[key]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
const ADMINS = { boss: 'Super Admin', adm: 'Administrator', ed: 'Editor' };
let db, r2;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  for (const [name, role] of Object.entries(ADMINS)) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
});

const call = async (fn, path, { as, body } = {}) => {
  const headers = as ? { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } : {};
  return fn({ request: new Request('https://shop.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers }),
    env: { DB: db, PHOTOS: r2, JWT_SECRET: SECRET }, waitUntil() {} });
};
const post = (body, as = 'adm') => call(musicFn, '/api/admin/music', { as, body });
const list = async (as = 'adm') => (await (await call(musicFn, '/api/admin/music', { as })).json()).tracks;
const publicList = async () => (await (await call(publicFn, '/api/invitations/music')).json()).tracks;

const mp3Url = (bytes = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]) => `data:audio/mpeg;base64,${Buffer.from(bytes).toString('base64')}`;
const create = async (title = 'Waltz', patch = {}) => {
  const res = await post({ action: 'create', title, credit: 'Some Artist', file: mp3Url(), ...patch });
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()).id;
};

test('rejects a non-MP3 and a file over 8 MB', async () => {
  const notMp3 = await post({ action: 'create', title: 'x', credit: '', file: `data:audio/mpeg;base64,${Buffer.from('not audio at all').toString('base64')}` });
  assert.equal(notMp3.status, 400);
  const wrongType = await post({ action: 'create', title: 'x', credit: '', file: 'data:image/png;base64,AAAA' });
  assert.equal(wrongType.status, 400);
  const big = await post({ action: 'create', title: 'x', credit: '', file: 'data:audio/mpeg;base64,' + 'A'.repeat(11_000_000) });
  assert.equal(big.status, 400);
  assert.match((await big.json()).error, /8 MB/);
  assert.equal((await post({ action: 'create', title: '', credit: '', file: mp3Url() })).status, 400);
  assert.equal(r2.map.size, 0);
});

test('create stores the mp3 under media/music/, lists it for admins and the public; update hides it', async () => {
  const id = await create();
  const keys = [...r2.map.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^media\/music\/\d+-[a-z0-9]{8}\.mp3$/);
  const [t] = await list();
  assert.deepEqual([t.id, t.title, t.credit, t.active], [id, 'Waltz', 'Some Artist', true]);
  assert.equal(t.url, '/media/' + keys[0].slice('media/'.length));
  assert.deepEqual(await publicList(), [{ id, title: 'Waltz', credit: 'Some Artist', url: t.url }]);
  assert.equal((await post({ action: 'update', id, title: 'Waltz 2', credit: '', active: false })).status, 200);
  assert.deepEqual(await publicList(), []);
  assert.equal((await list())[0].title, 'Waltz 2');
  assert.equal((await post({ action: 'update', id: 999, title: 'x', credit: '', active: true })).status, 404);
  assert.ok(db.exec.prepare("SELECT 1 FROM audit_logs WHERE log_type = 'music'").all().length >= 2);
});

test('reorder changes the order; delete removes the row and the R2 object', async () => {
  const a = await create('A');
  const b = await create('B');
  assert.deepEqual((await list()).map((t) => t.id), [a, b]);
  assert.equal((await post({ action: 'reorder', ids: [b, a] })).status, 200);
  assert.deepEqual((await publicList()).map((t) => t.id), [b, a]);
  assert.equal((await post({ action: 'reorder', ids: [a, a] })).status, 400);
  assert.equal((await post({ action: 'delete', id: a })).status, 200);
  assert.equal(r2.map.size, 1);
  assert.deepEqual((await list()).map((t) => t.id), [b]);
  assert.equal((await post({ action: 'delete', id: a })).status, 404);
});

test('the media route serves the mp3 as audio/mpeg and 404s bad paths', async () => {
  await create();
  const [t] = await list();
  const get = (p) => mediaFn({ request: new Request('https://shop.test' + p), env: { PHOTOS: r2 } });
  const ok = await get(t.url);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal((await get(t.url.replace('.mp3', '.wav'))).status, 404);
  assert.equal((await get('/media/music/..%2F..%2Fsecret.mp3')).status, 404);
  assert.equal((await get('/media/design/1-abcdefgh.mp3')).status, 404);
});

test('tolerates audio/mp3 and a bare MPEG frame header', async () => {
  const res = await post({ action: 'create', title: 'Frame', credit: '', file: 'data:audio/mp3;base64,' + Buffer.from([0xff, 0xfb, 0x90, 0]).toString('base64') });
  assert.equal(res.status, 200);
});

test('an Editor is refused and no token is 401', async () => {
  assert.equal((await post({ action: 'create', title: 'x', credit: '', file: mp3Url() }, 'ed')).status, 403);
  assert.equal((await call(musicFn, '/api/admin/music')).status, 401);
});

test('media route honours Range for audio: 206 slice, 200 without, 416 when unsatisfiable', async () => {
  await create();
  const [t] = await list();
  const get = (range) => mediaFn({ request: new Request('https://shop.test' + t.url, { headers: range ? { Range: range } : {} }), env: { PHOTOS: r2 } });
  const full = await get();
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Accept-Ranges'), 'bytes');
  const part = await get('bytes=0-3');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 0-3/10');
  assert.equal(part.headers.get('Content-Length'), '4');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [0x49, 0x44, 0x33, 4]);
  const open = await get('bytes=6-');
  assert.equal(open.headers.get('Content-Range'), 'bytes 6-9/10');
  assert.equal((await get('bytes=500-')).status, 416);
  assert.equal((await get('garbage')).status, 200);
});

test('media route handles a suffix range and sets Content-Length on a full response', async () => {
  await create();
  const [t] = await list();
  const get = (range) => mediaFn({ request: new Request('https://shop.test' + t.url, { headers: range ? { Range: range } : {} }), env: { PHOTOS: r2 } });
  const part = await get('bytes=-4');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 6-9/10');
  assert.equal(part.headers.get('Content-Length'), '4');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [0, 0, 0, 0]);
  assert.equal((await get('bytes=-99')).headers.get('Content-Range'), 'bytes 0-9/10');
  assert.equal((await get()).headers.get('Content-Length'), '10');
});
