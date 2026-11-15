// Admin designs API (portal), on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: designsFn } = await bundle('functions/api/admin/designs/[[path]].ts');
const { onRequest: invitationsFn } = await bundle('functions/api/admin/invitations/[[path]].ts');
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
const post = (body, as = 'adm') => call(designsFn, '/api/admin/designs', { as, body });
const get = (path = '', as = 'adm') => call(designsFn, '/api/admin/designs' + path, { as });
const row = (id) => db.exec.prepare('SELECT * FROM products_designs WHERE id = ?').get(id);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const pngUrl = `data:image/png;base64,${PNG.toString('base64')}`;
const scheme = { name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' };
const details = { partner1: 'Ana', partner2: 'Ben', eventDate: '2099-06-01', ceremony: { name: 'Chapel', address: '1 Main St', mapUrl: '' }, schedule: [] };
const pkg = (key, priceCentavos, kind = 'template') => ({ key, name: key, priceCentavos, inclusions: ['RSVP'], kind });
const good = {
  action: 'create', name: 'New Look', slug: 'new-look', productType: 'wedding_invitation', layoutKey: 'garden', description: 'Soft greens.',
  colorSchemes: [scheme], previewImages: ['https://cdn.test/a.jpg'], sampleDetails: details,
  packages: [pkg('premium', 249900), pkg('standard', 149900)], featured: true, active: true,
};
const create = async (patch = {}) => {
  const res = await post({ ...good, ...patch });
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()).id;
};
// An order whose invitation uses design <designId>
const addOrder = (designId) => {
  const i = db.exec.prepare(`INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
    VALUES (?, ?, '{}', '{}', '[]', 'pending', '2099-06-01', ?)`).run(designId, `s-${Math.random()}`, `h${Math.random()}`);
  db.exec.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status) VALUES (?, 'c@x.com', 149900, 'pending_payment')").run(Number(i.lastInsertRowid));
};

test('create with two packages → price is the lowest template; list and detail shapes; audit row', async () => {
  const id = await create({ packages: [pkg('premium', 249900), pkg('custom', 5000, 'custom'), pkg('standard', 149900)] });
  assert.equal(row(id).price_centavos, 149900);
  const { designs } = await (await get()).json();
  const d = designs.find((x) => x.id === id);
  assert.equal(d.fromPriceCentavos, 149900);
  assert.equal(d.productType, 'wedding_invitation');
  assert.equal(d.featured, true);
  assert.equal(d.orderCount, 0);
  assert.equal(d.packages.length, 3);
  const full = (await (await get(`/${id}`)).json()).design;
  assert.deepEqual(full.colorSchemes, [scheme]);
  assert.equal(full.description, 'Soft greens.');
  assert.equal(full.sampleDetails.partner1, 'Ana');
  assert.equal((await get('/999')).status, 404);
  const log = db.exec.prepare("SELECT message FROM audit_logs WHERE log_type = 'design'").all();
  assert.equal(log.length, 1);
  assert.match(log[0].message, /adm@jlc\.test.*create.*new-look/);
});

test('validation → 400 with message: zero template, duplicate keys, bad fields, too many images', async () => {
  const cases = [
    [{ packages: [pkg('custom', 5000, 'custom')] }, 'Each design needs at least one package that can be ordered online.'],
    [{ packages: [pkg('standard', 5000), pkg('standard', 6000)] }, 'Package keys must be unique.'],
    [{ previewImages: Array(7).fill('https://cdn.test/a.jpg') }, 'A design can have up to 6 preview images.'],
    [{ previewImages: ['http://insecure/a.jpg'] }, null], [{ previewImages: ['/media/receipts/x.png'] }, null],
    [{ layoutKey: 'nope' }, null], [{ slug: 'Bad Slug' }, null], [{ name: '' }, null], [{ colorSchemes: [] }, null],
    [{ sampleDetails: { partner1: 'only' } }, null], [{ description: 'x'.repeat(601) }, null], [{ productType: 'nope' }, null],
  ];
  for (const [patch, msg] of cases) {
    const res = await post({ ...good, ...patch });
    assert.equal(res.status, 400, JSON.stringify(patch));
    const { error } = await res.json();
    if (msg) assert.equal(error, msg);
    else assert.ok(error);
  }
  assert.equal((await post({ ...good, previewImages: ['data:image/png;base64,bm90LWFuLWltYWdl'] })).status, 400);
  assert.equal(r2.map.size, 0);
  assert.equal(db.exec.prepare('SELECT COUNT(*) AS n FROM products_designs').get().n, 0);
  assert.equal((await post({ action: 'bogus' })).status, 400);
});

test('dataUrl image is stored and returned as /media/design/…; removing it deletes the object', async () => {
  const id = await create({ previewImages: ['https://cdn.test/a.jpg', pngUrl] });
  const imgs = JSON.parse(row(id).preview_images);
  assert.equal(imgs[0], 'https://cdn.test/a.jpg');
  assert.match(imgs[1], /^\/media\/design\/\d+-[a-z0-9]{8}\.png$/);
  const key = 'media' + imgs[1].slice('/media'.length);
  assert.ok(r2.map.has(key));
  assert.deepEqual((await (await get()).json()).designs[0].previewImages, imgs);
  // Keeping the existing path keeps the object
  assert.equal((await post({ ...good, action: 'update', id, previewImages: [imgs[1]] })).status, 200);
  assert.ok(r2.map.has(key));
  assert.equal((await post({ ...good, action: 'update', id, previewImages: ['https://cdn.test/a.jpg'] })).status, 200);
  assert.equal(r2.map.has(key), false);
  assert.deepEqual(JSON.parse(row(id).preview_images), ['https://cdn.test/a.jpg']);
});

test('a /media path must already belong to the design: create → 400; another design\'s image → 400 and kept', async () => {
  const a = await create({ previewImages: [pngUrl] });
  const aImg = JSON.parse(row(a).preview_images)[0];
  const aKey = 'media' + aImg.slice('/media'.length);
  const res = await post({ ...good, slug: 'b', previewImages: [aImg] });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "That image doesn't belong to this design.");
  const b = await create({ slug: 'b' });
  assert.equal((await post({ ...good, action: 'update', id: b, slug: 'b', previewImages: [aImg] })).status, 400);
  assert.equal((await post({ ...good, action: 'update', id: b, slug: 'b', previewImages: [] })).status, 200);
  assert.ok(r2.map.has(aKey));
  assert.deepEqual(JSON.parse(row(a).preview_images), [aImg]);
});

test('an R2 put that throws removes the images already uploaded in that request → 500', async () => {
  const put = r2.put;
  let n = 0;
  r2.put = async (...a) => { if (++n === 2) throw new Error('R2 down'); return put(...a); };
  const err = console.error; console.error = () => {};
  try { assert.equal((await post({ ...good, previewImages: [pngUrl, pngUrl] })).status, 500); } finally { console.error = err; }
  assert.equal(n, 2);
  assert.equal(r2.map.size, 0);
  assert.equal(db.exec.prepare('SELECT COUNT(*) AS n FROM products_designs').get().n, 0);
});

test('a failed DB write deletes the media uploaded in that request', async () => {
  await create();
  // Same slug in a racing insert: simulate by making the slug check pass but the INSERT fail
  db.exec.exec("CREATE TRIGGER no_insert BEFORE INSERT ON products_designs BEGIN SELECT RAISE(ABORT, 'boom'); END");
  const err = console.error; console.error = () => {};
  try { assert.equal((await post({ ...good, slug: 'other', previewImages: [pngUrl] })).status, 500); } finally { console.error = err; }
  assert.equal(r2.map.size, 0);
});

test('slug change after an order → 409; other edits allowed; productType and layout immutable → 409; taken slug → 409', async () => {
  const id = await create();
  await create({ slug: 'taken' });
  assert.equal((await post({ ...good, action: 'update', id, slug: 'taken' })).status, 409);
  assert.equal((await post({ ...good, action: 'update', id, slug: 'renamed-before-orders' })).status, 200);
  addOrder(id);
  assert.equal((await (await get()).json()).designs.find((d) => d.id === id).orderCount, 1);
  const res = await post({ ...good, action: 'update', id, slug: 'renamed' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "This design already has orders, so its web address can't change.");
  assert.equal((await post({ ...good, action: 'update', id, slug: 'renamed-before-orders', name: 'Renamed' })).status, 200);
  assert.equal(row(id).name, 'Renamed');
  const bday = { productType: 'birthday_invitation', layoutKey: 'confetti', sampleDetails: { celebrant: 'Mia', age: 7, eventDate: '2099-03-14', eventTime: '15:00', venue: { name: 'Hall', address: '1 Main St', mapUrl: '' }, schedule: [] } };
  assert.equal((await post({ ...good, ...bday, action: 'update', id, slug: 'renamed-before-orders' })).status, 409);
  assert.equal((await post({ ...good, action: 'update', id, slug: 'renamed-before-orders', layoutKey: 'classic' })).status, 409);
  assert.equal((await post({ ...good, action: 'update', id: 999 })).status, 404);
});

test('toggle and reorder, each audited', async () => {
  const a = await create();
  const b = await create({ slug: 'second' });
  assert.equal((await post({ action: 'toggle', id: a, field: 'active', value: false })).status, 200);
  assert.equal(row(a).active, 0);
  assert.equal((await post({ action: 'toggle', id: a, field: 'featured', value: false })).status, 200);
  assert.equal(row(a).featured, 0);
  assert.equal((await post({ action: 'toggle', id: a, field: 'price_centavos', value: true })).status, 400);
  assert.equal((await post({ action: 'toggle', id: a, field: 'active', value: 'no' })).status, 400);
  assert.equal((await post({ action: 'toggle', id: 999, field: 'active', value: true })).status, 404);
  assert.equal((await post({ action: 'reorder', ids: [b, a] })).status, 200);
  assert.deepEqual([row(a).sort_order, row(b).sort_order], [2, 1]);
  assert.equal((await post({ action: 'reorder', ids: [a, a] })).status, 400);
  assert.equal(db.exec.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE log_type = 'design'").get().n, 5);
});

test('Editor → 403; no token → 401; old invitations designs route gone', async () => {
  assert.equal((await get('', 'ed')).status, 403);
  assert.equal((await post(good, 'ed')).status, 403);
  assert.equal((await call(designsFn, '/api/admin/designs')).status, 401);
  assert.equal((await post(good, 'boss')).status, 200);
  assert.equal((await call(invitationsFn, '/api/admin/invitations/designs', { as: 'boss', body: { ...good, action: 'add' } })).status, 404);
  const overview = await (await call(invitationsFn, '/api/admin/invitations/overview', { as: 'boss' })).json();
  assert.equal(overview.designs, undefined);
});
