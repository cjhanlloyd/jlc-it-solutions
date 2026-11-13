import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';

const ins = (db, email) => db.prepare('INSERT INTO admins (email, fullName, createdAt) VALUES (?, ?, ?)').bind(email, 'A', 'now');

test('insert then first returns a plain row; run gives meta', async () => {
  const db = makeD1();
  const r = await ins(db, 'a@x.com').run();
  assert.equal(r.meta.changes, 1);
  const row = await db.prepare('SELECT email, fullName FROM admins WHERE email = ?').bind('a@x.com').first();
  assert.deepEqual(row, { email: 'a@x.com', fullName: 'A' });
  assert.equal(await db.prepare('SELECT 1 FROM admins WHERE email = ?').bind('zz').first(), null);
  const { results } = await db.prepare('SELECT email FROM admins').all();
  assert.deepEqual(results, [{ email: 'a@x.com' }]);
});

test('batch rolls back when a statement throws', async () => {
  const db = makeD1();
  await ins(db, 'a@x.com').run();
  await assert.rejects(db.batch([
    db.prepare("UPDATE admins SET fullName = 'B'"),
    db.prepare('UPDATE nope SET x = 1'),
  ]));
  const row = await db.prepare('SELECT fullName FROM admins').first();
  assert.equal(row.fullName, 'A');
});

test('last_row_id and undefined binds as null', async () => {
  const db = makeD1();
  const r = await db.prepare('INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)').bind('now', 'x', 'm').run();
  assert.ok(r.meta.last_row_id >= 1);
});

test('r2 put/get/head/delete/list', async () => {
  const r2 = makeR2();
  await r2.put('p/a', new Uint8Array([1, 2]), { httpMetadata: { contentType: 'image/png' } });
  const o = await r2.get('p/a');
  assert.equal(o.httpMetadata.contentType, 'image/png');
  assert.equal((await o.arrayBuffer()).byteLength, 2);
  assert.ok(await r2.head('p/a'));
  assert.equal((await r2.list({ prefix: 'p/' })).objects[0].key, 'p/a');
  await r2.delete(['p/a']);
  assert.equal(await r2.get('p/a'), null);
});

test('undefined binds as null', async () => {
  const db = makeD1();
  await db.prepare('INSERT INTO admins (email, fullName, createdAt, passwordHash) VALUES (?, ?, ?, ?)').bind('u@x.com', 'U', 'now', undefined).run();
  assert.equal((await db.prepare('SELECT passwordHash FROM admins').first()).passwordHash, null);
});

test('concurrent batches and a racing run are serialised', async () => {
  const db = makeD1();
  const add = (e) => db.prepare('INSERT INTO admins (email, fullName, createdAt) VALUES (?, ?, ?)').bind(e, 'A', 'now');
  await Promise.all([db.batch([add('a'), add('b')]), db.batch([add('c'), add('d')]), add('e').run()]);
  const { results } = await db.prepare('SELECT email FROM admins ORDER BY email').all();
  assert.deepEqual(results.map((r) => r.email), ['a', 'b', 'c', 'd', 'e']);
});
