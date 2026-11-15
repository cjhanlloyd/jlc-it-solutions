import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { putMedia, mediaUrl, deleteMedia } = await bundle('server/media.ts');
const { onRequestGet } = await bundle('functions/media/[[key]].ts');
const { can } = await bundle('server/permissions.ts');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = `data:image/png;base64,${PNG.toString('base64')}`;
const get = (r2, url) => onRequestGet({ request: new Request('https://x.test' + url), env: { PHOTOS: r2 } });

test('PNG is stored under media/design and served with immutable cache + nosniff', async () => {
  const r2 = makeR2();
  const out = await putMedia(r2, 'design', png);
  assert.match(out.key, /^media\/design\/\d+-[a-z0-9]{8}\.png$/);
  assert.equal(mediaUrl(out.key), '/' + out.key);
  const res = await get(r2, mediaUrl(out.key));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  await deleteMedia(r2, out.key);
  assert.equal((await get(r2, mediaUrl(out.key))).status, 404);
});

test('bad uploads are rejected', async () => {
  const r2 = makeR2();
  const svg = `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`;
  assert.ok((await putMedia(r2, 'design', svg)).error);
  const big = `data:image/png;base64,${Buffer.concat([PNG, Buffer.alloc(3_000_000)]).toString('base64')}`;
  assert.ok((await putMedia(r2, 'design', big)).error);
  assert.equal(r2.map.size, 0);
});

test('only media/ keys are served; deleteMedia ignores others', async () => {
  const r2 = makeR2();
  await r2.put('receipts/1/a.png', PNG, { httpMetadata: { contentType: 'image/png' } });
  await r2.put('inv/1/0.png', PNG);
  for (const u of ['/media/x/../../receipts/1/a.png', '/media/../receipts/1/a.png', '/media/%2e%2e/receipts/1/a.png', '/media/design/%E0%A4%A', '/media/', '/media/design/1-abcdefgh.gif', '/media/design%5C1-abcdefgh.png'])
    assert.equal((await get(r2, u)).status, 404, u);
  await deleteMedia(r2, 'receipts/1/a.png');
  assert.ok(r2.map.has('receipts/1/a.png'));
});

test('media permissions', () => {
  for (const a of ['designs.manage', 'content.manage', 'reports.view']) {
    assert.equal(can('Editor', a), false);
    assert.equal(can('Administrator', a), true);
    assert.equal(can('Super Admin', a), true);
  }
});
