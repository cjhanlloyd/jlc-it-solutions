// Content APIs (admin + public), on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: adminFn } = await bundle('functions/api/admin/content/[[path]].ts');
const { onRequestGet: siteFn } = await bundle('functions/api/site.ts');
const { signAdminToken } = await bundle('server/crypto.ts');

const SECRET = 'jwt-secret';
let db, r2;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  for (const [n, role] of Object.entries({ adm: 'Administrator', ed: 'Editor' })) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${n}@jlc.test`, n, role);
  }
  db.exec.prepare("INSERT INTO content (id, heroTitle, contactEmail) VALUES ('default', 'Hero', 'a@b.c')").run();
  db.exec.prepare("INSERT INTO branding (id, companyName) VALUES ('default', 'JLC')").run();
});
const env = () => ({ DB: db, PHOTOS: r2, JWT_SECRET: SECRET });
const post = async (body, as = 'adm') => adminFn({ request: new Request('https://x.test/api/admin/content', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }), env: env(), waitUntil() {} });
const getAdmin = async (as = 'adm') => adminFn({ request: new Request('https://x.test/api/admin/content', { headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }), env: env(), waitUntil() {} });
const site = () => siteFn({ request: new Request('https://x.test/api/site'), env: env(), waitUntil() {} });
const ok = async (body) => { const r = await post(body); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
const bad = async (body, msg) => { const r = await post(body); assert.equal(r.status, 400); if (msg) assert.match((await r.json()).error, msg); };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x')]);
const png = `data:image/png;base64,${PNG.toString('base64')}`;
const b0 = () => ({ section: 'banner', message: 'm', active: true });
const x = (n) => 'a'.repeat(n);
const manila = (d = 0) => new Date(Date.now() + 8 * 3600e3 + d * 864e5).toISOString().slice(0, 10);

test('Editor and anonymous are refused', async () => {
  assert.equal((await post({ section: 'home' }, 'ed')).status, 403);
  assert.equal((await getAdmin('ed')).status, 403);
  assert.equal((await adminFn({ request: new Request('https://x.test/api/admin/content'), env: env(), waitUntil() {} })).status, 401);
});

test('text limits', async () => {
  const home = { section: 'home', eyebrow: 'e', headline: 'h', subheadline: 's' };
  await ok(home);
  await bad({ ...home, eyebrow: x(41) }); await bad({ ...home, headline: x(91) }); await bad({ ...home, subheadline: x(241) });
  await ok({ ...home, eyebrow: x(40), headline: x(90), subheadline: x(240) });
  const faq = { section: 'faq', action: 'save', question: 'q', answer: 'a' };
  await ok(faq);
  await bad({ ...faq, question: x(161) }); await bad({ ...faq, answer: x(801) });
  await bad({ ...faq, answer: 'see [x](//evil.com)' }, /Links in answers/);
  await bad({ ...faq, answer: 'see [x](http://a.com)' }, /Links in answers/);
  await bad({ ...faq, answer: 'see [x](/\\evil.com)' }, /Links in answers/);
  for (const a of ['<https://x>', '[a][1]\n[1]: https://x', 'javascript:alert(1)']) await bad({ ...faq, answer: a }, /Answers can only use/);
  await bad({ ...b0(), link: '/\\evil.com' });
  await ok({ ...faq, answer: 'see [x](/a) [y](https://a.com)' });
  const t = { section: 'testimonial', action: 'save', name: 'n', occasion: 'o', quote: 'q', published: true };
  await ok(t);
  await bad({ ...t, name: x(61) }); await bad({ ...t, occasion: x(41) }); await bad({ ...t, quote: x(301) });
  await bad({ ...t, photo: 'data:text/plain;base64,AAAA' });
  const b = { section: 'banner', message: 'm', link: '/x', active: true, startsAt: '', endsAt: '' };
  await ok(b);
  await bad({ ...b, message: x(141) }); await bad({ ...b, link: '//evil.com' }); await bad({ ...b, link: 'http://a.com' }, /start with/);
  await bad({ ...b, startsAt: 'tomorrow' });
  const c = { section: 'contact', email: 'a@b.c', phone: '1', address: 'a', hours: 'h', mapEmbedUrl: '', facebookUrl: '', whatsappUrl: '', viberUrl: '' };
  await ok(c);
  await bad({ ...c, mapEmbedUrl: 'https://evil.com/maps/embed' }); await bad({ ...c, facebookUrl: 'http://fb.com' });
  await ok({ ...c, mapEmbedUrl: 'https://www.google.com/maps/embed?pb=1', facebookUrl: 'https://fb.com/x' });
  await bad({ section: 'branding', companyName: 'J', tagline: '', logoType: 'image', logoIcon: 'Activity', logo: 'data:image/png;base64,' + Buffer.alloc(500_001).toString('base64') });
});

test('banner is public only while active and in its dates', async () => {
  const b = { section: 'banner', message: 'Sale', link: '/designs', active: true };
  await ok({ ...b, startsAt: manila(1), endsAt: '' });
  assert.equal((await (await site()).json()).banner, null);
  await ok({ ...b, startsAt: '', endsAt: manila(-1) });
  assert.equal((await (await site()).json()).banner, null);
  await ok({ ...b, active: false });
  assert.equal((await (await site()).json()).banner, null);
  await ok({ ...b, startsAt: manila(-1), endsAt: manila(0) });
  const res = await site();
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
  assert.deepEqual((await res.json()).banner, { message: 'Sale', link: '/designs' });
});

test('unpublished testimonials hidden; photo stored as media and cleaned up', async () => {
  await ok({ section: 'testimonial', action: 'save', name: 'Pub', occasion: '', quote: 'q', published: true, photo: png });
  await ok({ section: 'testimonial', action: 'save', name: 'Hid', occasion: '', quote: 'q', published: false });
  const s = await (await site()).json();
  assert.deepEqual(s.testimonials.map((t) => t.name), ['Pub']);
  assert.match(s.testimonials[0].photoUrl, /^\/media\/testimonial\//);
  const all = (await (await getAdmin()).json()).testimonials;
  assert.equal(all.length, 2);
  const pub = all.find((t) => t.name === 'Pub');
  await ok({ section: 'testimonial', action: 'delete', id: pub.id });
  assert.equal((await r2.list({ prefix: 'media/testimonial/' })).objects.length, 0);
});

test('faq reorder persists sort_order; public returns q/a in order', async () => {
  const ids = (await (await getAdmin()).json()).faqs.map((f) => f.id);
  assert.ok(ids.length >= 3);
  const rev = [...ids].reverse();
  await ok({ section: 'faq', action: 'reorder', ids: rev });
  assert.deepEqual(db.exec.prepare("SELECT id FROM faqs WHERE category='invitations' ORDER BY sort_order").all().map((r) => r.id), rev);
  const s = await (await site()).json();
  assert.deepEqual(Object.keys(s.faqs[0]), ['q', 'a']);
  await bad({ section: 'faq', action: 'reorder', ids: ids.slice(1) });
});

test('contact, branding and home round-trip, and writes are audited', async () => {
  await ok({ section: 'home', eyebrow: 'E', headline: 'H', subheadline: 'S' });
  await ok({ section: 'contact', email: 'n@x.com', phone: '1', address: 'A', hours: 'H', mapEmbedUrl: '', facebookUrl: '', whatsappUrl: '', viberUrl: '' });
  await ok({ section: 'branding', companyName: 'New', tagline: 'T', logoType: 'image', logoIcon: 'Activity', logo: png });
  const a = await (await getAdmin()).json();
  assert.deepEqual(a.home, { eyebrow: 'E', headline: 'H', subheadline: 'S' });
  assert.equal(a.contact.email, 'n@x.com');
  assert.equal(a.branding.companyName, 'New');
  assert.equal(a.branding.logoUrl, png);
  assert.equal((await (await site()).json()).home.headline, 'H');
  assert.equal(db.exec.prepare("SELECT COUNT(*) c FROM audit_logs WHERE log_type='content'").get().c, 3);
});


test('branding saves themeColor; unknown values are refused; omitting it keeps the stored one', async () => {
  const b = { section: 'branding', companyName: 'New', tagline: '', logoType: 'icon', logoIcon: 'Activity' };
  assert.equal((await (await getAdmin()).json()).branding.themeColor, 'deepblue');
  await ok({ ...b, themeColor: 'violet' });
  assert.equal((await (await getAdmin()).json()).branding.themeColor, 'violet');
  await bad({ ...b, themeColor: 'pink' }, /colour/);
  await ok(b);
  assert.equal(db.exec.prepare("SELECT themeColor t FROM branding").get().t, 'violet');
});
