// Design marketing fields (description, featured): real-SQL harness. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: pub } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: admin } = await bundle('functions/api/admin/designs/[[path]].ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
const scheme = { name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' };
const design = { action: 'create', productType: 'wedding_invitation', slug: 'new-look', name: 'New Look', layoutKey: 'garden',
  packages: [{ key: 'standard', name: 'Standard', priceCentavos: 149900, inclusions: [], kind: 'template' }],
  colorSchemes: [scheme], previewImages: [], sampleDetails: { partner1: 'Ana', partner2: 'Ben', eventDate: '2099-06-01', ceremony: { name: 'Chapel', address: '1 Main St', mapUrl: '' }, schedule: [] }, active: true };

let db;
beforeEach(() => {
  db = makeD1();
  db.exec.exec("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES ('boss@x.com', 'Boss', 'Super Admin', 'Active', 1, 't')");
});

const list = async () => (await (await pub({ request: new Request('https://shop.test/api/invitations/designs'), env: { DB: db }, waitUntil() {} })).json()).designs;
const add = async (extra) => admin({
  request: new Request('https://shop.test/api/admin/designs', { method: 'POST', body: JSON.stringify({ ...design, ...extra }),
    headers: { Authorization: 'Bearer ' + await signAdminToken('boss@x.com', SECRET) } }),
  env: { DB: db, JWT_SECRET: SECRET }, waitUntil() {} });

test('designs list defaults to empty description, not featured', async () => {
  await add({});
  const d = (await list()).find((x) => x.slug === 'new-look');
  assert.equal(d.description, '');
  assert.equal(d.featured, false);
});

test('admin add rejects a description over 600 chars', async () => {
  assert.equal((await add({ description: 'x'.repeat(601) })).status, 400);
});

test('admin add stores trimmed description and featured', async () => {
  assert.equal((await add({ description: ' Elegant ', featured: true })).status, 200);
  const row = db.exec.prepare('SELECT description, featured FROM products_designs WHERE slug = ?').get('new-look');
  assert.equal(row.description, 'Elegant');
  assert.equal(row.featured, 1);
  const d = (await list()).find((x) => x.slug === 'new-look');
  assert.equal(d.featured, true);
  assert.equal(d.description, 'Elegant');
});
