// /photos/ serves invitation_media keys only while approved and live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequestGet: photoRoute } = await bundle('functions/photos/[[key]].ts', 'photo.mjs');
const db = makeD1();
const r2 = makeR2();
db.exec.exec("INSERT INTO products_designs (id, slug, name, layout_key, price_centavos) VALUES (1, 'rose', 'Rose', 'classic', 150000)");
for (const [id, status] of [[1, 'live'], [2, 'expired']]) {
  db.exec.prepare("INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash) VALUES (?, 1, ?, 'blush', '{}', '[]', ?, '2099-01-01', ?)").run(id, `s${id}`, status, `h${id}`);
}
for (const [inv, name, st] of [[1, 'a', 'approved'], [1, 'p', 'pending'], [1, 'r', 'rejected'], [2, 'a', 'approved']]) {
  const key = `inv/${inv}/${name}.jpg`;
  await r2.put(key, 'img');
  db.exec.prepare('INSERT INTO invitation_media (invitation_id, kind, r2_key, status) VALUES (?, ?, ?, ?)').run(inv, 'guest', key, st);
}
await r2.put('inv/1/unlisted.jpg', 'img');
const get = (key) => photoRoute({ request: new Request('https://shop.test/photos/' + key), env: { DB: db, PHOTOS: r2 } });

test('approved media of a live invitation is served', async () => assert.equal((await get('inv/1/a.jpg')).status, 200));
test('pending, rejected and unlisted keys are 404', async () => {
  for (const k of ['inv/1/p.jpg', 'inv/1/r.jpg', 'inv/1/unlisted.jpg']) assert.equal((await get(k)).status, 404, k);
});
test('approved media of a non-live invitation is 404', async () => assert.equal((await get('inv/2/a.jpg')).status, 404));
test('a key cannot be served through another invitation id', async () => {
  await r2.put('inv/3/a.jpg', 'img');
  assert.equal((await get('inv/3/a.jpg')).status, 404);
});
