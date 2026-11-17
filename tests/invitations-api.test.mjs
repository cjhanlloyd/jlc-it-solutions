// Tests for the invitations API: designs, checkout validation, manage, RSVP, resend, guest. Run: npm test
// Real-SQL D1 and R2 fakes (tests/helpers); SMTP and Turnstile are stubbed. GCash checkout success,
// the order page and receipts are in orders-api.test.mjs; the PayMongo webhook is in payments.test.mjs.
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
const TOKEN = 'manage-token-1';
const SCHEMES = JSON.stringify([{ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' }]);
const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
const weddingDetails = { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } };
const bdayDetails = { celebrant: 'Mia', age: 7, eventDate: '2027-06-12', venue: { name: 'Fun Hall' } };

let db, r2, background;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  background = [];
  globalThis.SMTP_SENT = [];
  globalThis.SMTP_FAIL = false;
  const d = (id, slug, name, layout, type, active = 1) =>
    `(${id}, '${slug}', '${name}', '${layout}', 99900, '${SCHEMES}', ${active}, 0, '${type}')`;
  db.exec.exec(`
    INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type) VALUES
      ${d(1, 'classic-elegance', 'Classic Elegance', 'classic', 'wedding_invitation')},
      ${d(2, 'hidden', 'Classic Elegance', 'classic', 'wedding_invitation', 0)},
      ${d(3, 'confetti-pop', 'Confetti Pop', 'confetti', 'birthday_invitation')},
      ${d(4, 'baptism', 'Classic Elegance', 'classic', 'baptism_invitation')};
    INSERT INTO smtp_settings (id, host, port, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, 'JLC', 'co@x.com', 1);
    UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '0917', qr_key = 'settings/qr.png';`);
});
const settle = () => Promise.all(background.splice(0));
const env = () => ({ DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret' });
const ctx = (request) => ({ request, env: env(), waitUntil(p) { background.push(p); } });
const get = (path) => invitations(ctx(new Request('https://shop.test' + path)));
const post = (path, body) => invitations(ctx(new Request('https://shop.test' + path, { method: 'POST', body: JSON.stringify(body) })));
const call = (method, path, body, token) => invitations(ctx(new Request('https://shop.test' + path, {
  method, body: body === undefined ? undefined : JSON.stringify(body), headers: token === undefined ? {} : { 'X-Manage-Token': token } })));
const q = (sql, ...a) => db.exec.prepare(sql).all(...a);
const sql = (s, ...a) => db.exec.prepare(s).run(...a);
const inv = () => q('SELECT * FROM invitations WHERE id = 1')[0];
const rsvps = () => q('SELECT * FROM rsvps ORDER BY id');
const emails = () => globalThis.SMTP_SENT.filter(t => t.startsWith('Message-ID'));

const goodCheckout = (extra = {}) => ({
  designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'Bride@Example.com', name: 'Maria', termsAccepted: true, turnstileToken: 'good-token',
  details: weddingDetails, photos: [PNG], ...extra,
});
const bdayCheckout = (extra = {}) => goodCheckout({ designSlug: 'confetti-pop', details: bdayDetails, ...extra });

// A delivered order with a live invitation (id 1, photo inv/1/0.png) whose manage token is TOKEN
function seedLive(designId, slug, details) {
  sql(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
    VALUES (1, ?, ?, ?, ?, '["inv/1/0.png"]', 'live', ?, ?)`, designId, slug, JSON.stringify(JSON.parse(SCHEMES)[0]), JSON.stringify(details), details.eventDate, hash(TOKEN));
  sql(`INSERT INTO orders (id, product_id, customer_email, amount_centavos, status, reference) VALUES (1, 1, 'bride@example.com', 99900, 'delivered', 'JLC-ABCDEF')`);
  r2.map.set('inv/1/0.png', { body: 'fake-png', bytes: Buffer.from('fake-png'), httpMetadata: { contentType: 'image/png' } });
  return inv();
}
const live = () => seedLive(1, 'maria-and-juan-abc123', weddingDetails);
const liveBirthday = () => seedLive(3, 'mia-7th-birthday-abc123', bdayDetails);
const setDetails = (extra) => sql('UPDATE invitations SET details = ? WHERE id = 1', JSON.stringify({ ...JSON.parse(inv().details), ...extra }));
const editBody = (details = {}, photos = ['inv/1/0.png']) => ({ details: { ...JSON.parse(inv().details), ...details }, photos });
const rsvp = (slug, extra = {}) => post(`/api/invitations/i/${slug}/rsvp`, { guestName: 'Ana', attending: true, partySize: 2, message: 'See you!', turnstileToken: 'good-token', ...extra });
const addRsvp = (name, attending, size, message) =>
  sql("INSERT INTO rsvps (invitation_id, guest_name, attending, party_size, message, created_at) VALUES (1, ?, ?, ?, ?, '2026-11-10 08:00:00')", name, attending, size, message);

test('designs lists active designs with public fields only', async () => {
  const res = await get('/api/invitations/designs');
  assert.equal(res.status, 200);
  const { designs } = await res.json();
  assert.equal(designs.length, 2);
  assert.deepEqual(Object.keys(designs[0]).sort(), ['colorSchemes', 'description', 'featured', 'fromPriceCentavos', 'layoutKey', 'name', 'packages', 'previewImages', 'priceCentavos', 'productType', 'sampleDetails', 'samplePhotos', 'slug']);
  assert.equal(designs[0].productType, 'wedding_invitation');
  assert.equal(designs[0].colorSchemes[0].name, 'Blush');
});

// --- Checkout validation (the GCash success path is in orders-api.test.mjs) ---
test('checkout without termsAccepted → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ termsAccepted: undefined }));
  assert.equal(res.status, 400);
  assert.equal(q('SELECT * FROM orders').length, 0);
});

test('checkout with a bad Turnstile token → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ turnstileToken: 'bad' }));
  assert.equal(res.status, 400);
  assert.equal(q('SELECT * FROM orders').length, 0);
});

test('checkout ignores amount in the body and charges the DB price; photos go to inv/<id>/', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ amount: 1, amountCentavos: 1 }));
  assert.equal(res.status, 200);
  assert.equal(q('SELECT amount_centavos FROM orders')[0].amount_centavos, 99900);
  const i = inv();
  assert.equal(i.status, 'pending');
  assert.match(i.slug, /^maria-and-juan-[a-z0-9]+$/);
  assert.deepEqual(JSON.parse(i.color_scheme), JSON.parse(SCHEMES)[0]);
  assert.deepEqual(JSON.parse(i.photos), ['inv/1/0.png']);
  assert.equal(r2.map.get('inv/1/0.png').httpMetadata.contentType, 'image/png');
  assert.equal(Buffer.from(r2.map.get('inv/1/0.png').bytes).toString(), 'fake-png');
});

test('checkout with 7 photos → 400', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ photos: Array(7).fill(PNG) }));
  assert.equal(res.status, 400);
  assert.equal(r2.map.size, 0);
});

test('checkout rejects non-image data URLs and unknown color schemes', async () => {
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ photos: ['data:text/html;base64,PGI+'] }))).status, 400);
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ colorScheme: 'Neon' }))).status, 400);
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ designSlug: 'hidden' }))).status, 400);
  assert.equal(q('SELECT * FROM invitations').length, 0);
});

test('checkout with a past wedding date → 400, nothing created', async () => {
  const res = await post('/api/invitations/checkout', goodCheckout({ details: { ...weddingDetails, eventDate: '2020-01-01' } }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /past/);
  assert.equal(q('SELECT * FROM invitations').length, 0);
});

// --- Manage, RSVP, resend ---
test('manage: no token, wrong token and a non-live invitation all get the identical 404', async () => {
  live();
  const bodies = [];
  for (const t of [undefined, 'wrong-token', 'unknown']) {
    const res = await call('GET', '/api/invitations/manage', undefined, t);
    assert.equal(res.status, 404);
    bodies.push(await res.text());
  }
  sql("UPDATE invitations SET status = 'refunded'");
  const res = await call('GET', '/api/invitations/manage', undefined, TOKEN);
  assert.equal(res.status, 404);
  bodies.push(await res.text());
  assert.deepEqual(new Set(bodies), new Set([JSON.stringify({ error: 'Invitation not found.' })]));
});

test('manage with the correct token returns details and RSVPs', async () => {
  const i = live();
  addRsvp('Ana', 1, 2, 'Yay');
  const res = await call('GET', '/api/invitations/manage', undefined, TOKEN);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.slug, i.slug);
  assert.equal(data.productType, 'wedding_invitation');
  assert.equal(data.status, 'live');
  assert.equal(data.design.slug, 'classic-elegance');
  assert.ok(data.design.colorSchemes.some((s) => s.name === 'Blush'), 'the design schemes, so the manage page can switch colours');
  assert.equal(data.colorScheme.name, 'Blush');
  assert.equal(data.details.partner2, 'Juan');
  assert.equal(data.title, 'Maria & Juan');
  assert.equal(data.askKids, false);
  assert.deepEqual(data.photos, ['inv/1/0.png']);
  assert.deepEqual(data.rsvps, [{ guestName: 'Ana', attending: true, partySize: 2, message: 'Yay', submitted: '2026-11-10 08:00:00', kidsCount: 0, guestId: null }]);
});

test('manage: renaming partner2 → 400, nothing stored', async () => {
  live();
  const res = await call('POST', '/api/invitations/manage', editBody({ partner2: 'Pedro' }), TOKEN);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Names cannot be changed after payment.');
  assert.equal(JSON.parse(inv().details).partner2, 'Juan');
});

test('manage: a date change → 200 and stored', async () => {
  live();
  const res = await call('POST', '/api/invitations/manage', editBody({ eventDate: '2027-07-01' }), TOKEN);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv().details).eventDate, '2027-07-01');
  assert.equal(inv().event_date, '2027-07-01');
  assert.ok(r2.map.has('inv/1/0.png'));
});

test('manage: changing the date to a past one → 400; an unchanged past date does not block other edits', async () => {
  live();
  let res = await call('POST', '/api/invitations/manage', editBody({ eventDate: '2020-01-01' }), TOKEN);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /past/);
  assert.equal(inv().event_date, '2027-06-12');
  setDetails({ eventDate: '2020-01-01' }); // the wedding already happened
  res = await call('POST', '/api/invitations/manage', editBody({ message: 'Thank you all!' }), TOKEN);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv().details).message, 'Thank you all!');
});

test('manage: photos keep existing keys, add data URLs, delete removed ones, reject foreign keys and design changes', async () => {
  live();
  let res = await call('POST', '/api/invitations/manage', editBody({}, [PNG]), TOKEN);
  assert.equal(res.status, 200);
  const keys = JSON.parse(inv().photos);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^inv\/1\/\d+\.png$/);
  assert.notEqual(keys[0], 'inv/1/0.png');
  assert.ok(!r2.map.has('inv/1/0.png'), 'removed photo deleted');
  assert.ok(r2.map.has(keys[0]));
  assert.deepEqual((await res.json()).photos, keys);
  for (const bad of [{ photos: ['inv/2/0.png'] }, { photos: Array(7).fill(PNG) }, { photos: ['data:text/html;base64,PGI+'] }, { colorScheme: 'Neon' }, { design: 'garden' }]) {
    res = await call('POST', '/api/invitations/manage', { ...editBody({}, keys), ...bad }, TOKEN);
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.deepEqual(JSON.parse(inv().photos), keys);
  assert.equal(r2.map.size, 1);
});

test('RSVP: a valid one is stored; refunded → 404; party size 11 → 400; bad Turnstile → 400; past deadline → 400', async () => {
  const i = live();
  assert.equal((await rsvp(i.slug)).status, 200);
  assert.deepEqual(rsvps().map(r => [r.invitation_id, r.guest_name, r.attending, r.party_size, r.message]), [[1, 'Ana', 1, 2, 'See you!']]);
  assert.equal((await rsvp(i.slug, { partySize: 11 })).status, 400);
  assert.equal((await rsvp(i.slug, { turnstileToken: 'bad' })).status, 400);
  setDetails({ rsvpDeadline: '2020-01-01' });
  const closed = await rsvp(i.slug);
  assert.equal(closed.status, 400);
  assert.equal((await closed.json()).error, 'RSVPs are closed.');
  sql("UPDATE invitations SET status = 'refunded'");
  const res = await rsvp(i.slug);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Invitation not found.' });
  assert.equal(rsvps().length, 1);
});

test('RSVP CSV escapes quotes and formula cells', async () => {
  live();
  addRsvp('=SUM(A1)', 0, 1, 'He said "hi"');
  const res = await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/csv/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.equal(lines[0], 'Name,Attending,Party size,Message,Submitted');
  assert.equal(lines[1], `"'=SUM(A1)","No","1","He said ""hi""","2026-11-10 08:00:00"`);
  assert.equal((await call('GET', '/api/invitations/manage/rsvps.csv', undefined, 'wrong')).status, 404);
});

test('resend for an unknown email → 200 and no email', async () => {
  live();
  const res = await post('/api/invitations/resend', { email: 'nobody@example.com', turnstileToken: 'good-token' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  await settle();
  assert.equal(emails().length, 0);
});

test('resend for a known email → 200, one email, old token stops working, new one works', async () => {
  live();
  const res = await post('/api/invitations/resend', { email: 'BRIDE@example.com', turnstileToken: 'good-token' });
  assert.deepEqual(await res.json(), { ok: true });
  await settle();
  assert.equal(emails().length, 1);
  const mail = emails()[0].replace(/=\r\n/g, '');
  assert.ok(mail.includes(`https://shop.test/i/${inv().slug}`));
  const fresh = mail.match(/https:\/\/shop\.test\/manage#([A-Za-z0-9_-]{43})/)[1];
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 404);
  assert.equal((await call('GET', '/api/invitations/manage', undefined, fresh)).status, 200);
});

test('resend: bad Turnstile → 400; after 3 per hour it still says ok but sends nothing', async () => {
  live();
  assert.equal((await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'bad' })).status, 400);
  for (let n = 0; n < 4; n++) {
    const res = await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' });
    assert.deepEqual(await res.json(), { ok: true });
  }
  await settle();
  assert.equal(emails().length, 3);
});

test('resend with SMTP disabled → ok, and the old manage token still works', async () => {
  live();
  sql('UPDATE smtp_settings SET enabled = 0');
  assert.deepEqual(await (await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' })).json(), { ok: true });
  await settle();
  assert.equal(emails().length, 0);
  assert.equal(inv().manage_token_hash, hash(TOKEN));
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 200);
});

test('resend where the SMTP send throws → ok, and the old manage token still works', async () => {
  live();
  globalThis.SMTP_FAIL = true;
  assert.deepEqual(await (await post('/api/invitations/resend', { email: 'bride@example.com', turnstileToken: 'good-token' })).json(), { ok: true });
  await settle();
  assert.equal(inv().manage_token_hash, hash(TOKEN));
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN)).status, 200);
});

// --- Occasions ---
test('designs list hides unknown occasions', async () => {
  const { designs } = await (await get('/api/invitations/designs')).json();
  assert.deepEqual(designs.map(d => d.slug), ['classic-elegance', 'confetti-pop']);
});

test('birthday checkout stores birthday details and slug', async () => {
  const res = await post('/api/invitations/checkout', bdayCheckout());
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv().details).celebrant, 'Mia');
  assert.match(inv().slug, /^mia-7th-birthday-[a-z0-9]+$/);
});

test('birthday checkout with wedding details → 400; unknown-occasion design → 400; birthday past date wording', async () => {
  let res = await post('/api/invitations/checkout', bdayCheckout({ details: weddingDetails }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Celebrant/);
  res = await post('/api/invitations/checkout', goodCheckout({ designSlug: 'baptism' }));
  assert.equal(res.status, 400);
  res = await post('/api/invitations/checkout', bdayCheckout({ details: { ...bdayDetails, eventDate: '2020-01-01' } }));
  assert.equal((await res.json()).error, 'The party date cannot be in the past.');
  assert.equal(q('SELECT * FROM invitations').length, 0);
});

test('birthday manage: renaming the celebrant → 400 with the birthday message; manage JSON has productType', async () => {
  liveBirthday();
  const res = await call('POST', '/api/invitations/manage', editBody({ celebrant: 'Zoe' }), TOKEN);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "The celebrant's name cannot be changed after payment.");
  const m = await (await call('GET', '/api/invitations/manage', undefined, TOKEN)).json();
  assert.equal(m.productType, 'birthday_invitation');
  assert.equal(m.askKids, true);
  assert.match(m.title, /'s .*Birthday$/);
});

test('birthday RSVP stores kids; manage JSON and CSV show them', async () => {
  const i = liveBirthday();
  assert.equal((await rsvp(i.slug, { partySize: 2, kidsCount: 3 })).status, 200);
  assert.equal(rsvps()[0].kids_count, 3);
  assert.equal((await rsvp(i.slug, { partySize: 2, kidsCount: 99 })).status, 400);
  const data = await (await call('GET', '/api/invitations/manage', undefined, TOKEN)).json();
  assert.equal(data.rsvps[0].kidsCount, 3);
  const lines = (await (await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN)).text()).trim().split('\r\n');
  assert.equal(lines[0], 'Name,Attending,Adults,Kids,Message,Submitted');
  assert.match(lines[1], /^"Ana","Yes","2","3",/);
});

test('wedding RSVP ignores kidsCount and keeps its CSV header', async () => {
  const i = live();
  assert.equal((await rsvp(i.slug, { kidsCount: 3 })).status, 200);
  assert.equal(rsvps()[0].kids_count, 0);
  const csvText = await (await call('GET', '/api/invitations/manage/rsvps.csv', undefined, TOKEN)).text();
  assert.equal(csvText.split('\r\n')[0], 'Name,Attending,Party size,Message,Submitted');
});

test('guest: live adds productType/askKids; expired returns only the title', async () => {
  const w = live();
  let g = await (await get(`/api/invitations/i/${w.slug}`)).json();
  assert.deepEqual([g.productType, g.askKids], ['wedding_invitation', false]);
  sql("UPDATE invitations SET status = 'expired'");
  setDetails({ partner1: 'Ana', partner2: 'Ben' });
  assert.deepEqual(await (await get(`/api/invitations/i/${w.slug}`)).json(), { state: 'expired', title: 'Ana & Ben' });
  sql('DELETE FROM invitations');
  sql('DELETE FROM orders');
  const b = liveBirthday();
  g = await (await get(`/api/invitations/i/${b.slug}`)).json();
  assert.deepEqual([g.productType, g.askKids], ['birthday_invitation', true]);
  sql("UPDATE invitations SET status = 'expired'");
  assert.deepEqual(await (await get(`/api/invitations/i/${b.slug}`)).json(), { state: 'expired', title: "Mia's 7th Birthday" });
});

// --- Invitation style (font, custom colours, cover) ---
const JPG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpg').toString('base64');
const COVER = { x: 40, y: 60, zoom: 1.5, tone: 'dark', strength: 0.4, fade: true };
const style = () => JSON.parse(inv().style);
const nothingStored = () => {
  assert.equal(q('SELECT * FROM invitations').length, 0);
  assert.equal(q('SELECT * FROM orders').length, 0);
  assert.equal(r2.map.size, 0);
};

test('checkout without a style stores {} and the named scheme, as before', async () => {
  assert.equal((await post('/api/invitations/checkout', goodCheckout())).status, 200);
  assert.deepEqual(style(), {});
  assert.deepEqual(JSON.parse(inv().color_scheme), JSON.parse(SCHEMES)[0]);
});

test('checkout stores the style with the cover index turned into its R2 key', async () => {
  const s = { v: 1, font: 'modern', cover: { photo: 1, ...COVER } };
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ photos: [PNG, JPG], style: s }))).status, 200);
  assert.deepEqual(JSON.parse(inv().photos), ['inv/1/0.png', 'inv/1/1.jpg']);
  assert.deepEqual(style(), { v: 1, font: 'modern', cover: { photo: 'inv/1/1.jpg', ...COVER } });
});

test("checkout with colorScheme 'Custom' stores 'Custom' with the derived colours and keeps style.colors", async () => {
  const colors = { primary: '#336699', accent: '#d4af37' };
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ colorScheme: 'Custom', style: { v: 1, colors } }))).status, 200);
  const scheme = JSON.parse(inv().color_scheme);
  assert.equal(scheme.name, 'Custom');
  assert.equal(scheme.accent, '#d4af37');
  assert.match(scheme.background, /^#[0-9a-f]{6}$/);
  assert.match(scheme.text, /^#[0-9a-f]{6}$/);
  assert.deepEqual(style().colors, colors);
});

test('checkout: every invalid style → 400 and nothing stored', async () => {
  const bad = [
    { style: { cover: { photo: 1, ...COVER } } }, // index past the one photo
    { style: { cover: { photo: -1, ...COVER } } },
    { style: { cover: { photo: 'inv/1/0.png', ...COVER } } }, // a key is not valid at checkout
    { style: { font: 'comic' } },
    { style: { cover: { photo: 0, ...COVER, zoom: 4 } } },
    { style: { cover: { photo: 0, ...COVER, x: -1 } } },
    { style: { cover: { photo: 0, ...COVER, y: 101 } } },
    { style: { cover: { photo: 0, ...COVER, strength: 0.9 } } },
    { style: { cover: { photo: 0, ...COVER, tone: 'neon' } } },
    { colorScheme: 'Custom', style: { colors: { primary: '#12345', accent: '#d4af37' } } },
    { colorScheme: 'Custom', style: {} }, // Custom needs colours
    { style: { colors: { primary: '#336699', accent: '#d4af37' } } }, // colours need Custom
    { style: { v: 2 } },
    { style: { layout: 'x' } },
    { style: 'dark' },
  ];
  for (const extra of bad) {
    const res = await post('/api/invitations/checkout', goodCheckout(extra));
    assert.equal(res.status, 400, JSON.stringify(extra));
    nothingStored();
  }
});

// Live invitation with photos 0.png and 1.png and the given stored style
const liveStyled = (s) => {
  live();
  sql(`UPDATE invitations SET photos = '["inv/1/0.png","inv/1/1.png"]', style = ? WHERE id = 1`, JSON.stringify(s));
  r2.map.set('inv/1/1.png', { body: 'fake-png-1', bytes: Buffer.from('fake-png-1'), httpMetadata: { contentType: 'image/png' } });
};
const manageStyle = async () => (await (await call('GET', '/api/invitations/manage', undefined, TOKEN)).json()).style;

test('manage GET returns style: {} for an old invitation, the stored style (cover as a key) otherwise', async () => {
  live();
  assert.deepEqual(await manageStyle(), {});
  sql('DELETE FROM invitations'); sql('DELETE FROM orders');
  const s = { v: 1, font: 'elegant', cover: { photo: 'inv/1/1.png', ...COVER } };
  liveStyled(s);
  assert.deepEqual(await manageStyle(), s);
});

test('manage edit of an old invitation without style keeps {} and the scheme exactly', async () => {
  const before = live();
  assert.equal((await call('POST', '/api/invitations/manage', editBody({ message: 'Hi' }), TOKEN)).status, 200);
  assert.equal(inv().style, '{}');
  assert.equal(inv().color_scheme, before.color_scheme);
});

test('manage edit with a style: an index points into the new photo list, an existing key is kept', async () => {
  liveStyled({});
  let res = await call('POST', '/api/invitations/manage', { ...editBody({}, ['inv/1/1.png', PNG]), style: { v: 1, font: 'playful', cover: { photo: 1, ...COVER } } }, TOKEN);
  assert.equal(res.status, 200);
  const keys = JSON.parse(inv().photos);
  assert.equal(keys[0], 'inv/1/1.png');
  assert.deepEqual(style(), { v: 1, font: 'playful', cover: { photo: keys[1], ...COVER } });
  assert.deepEqual((await res.json()).style, style());
  res = await call('POST', '/api/invitations/manage', { ...editBody({}, keys), style: { cover: { photo: 'inv/1/1.png', ...COVER } } }, TOKEN);
  assert.equal(res.status, 200);
  assert.deepEqual(style(), { cover: { photo: 'inv/1/1.png', ...COVER } });
});

test('manage edit: every invalid style → 400 and nothing stored', async () => {
  const s = { v: 1, font: 'classic', cover: { photo: 'inv/1/1.png', ...COVER } };
  liveStyled(s);
  const bad = [
    { photos: ['inv/1/0.png'], style: { cover: { photo: 'inv/1/1.png', ...COVER } } }, // key removed in this edit
    { style: { cover: { photo: 'inv/9/9.png', ...COVER } } },
    { style: { cover: { photo: 2, ...COVER } } },
    { photos: ['inv/1/0.png', 'inv/1/1.png', PNG], style: { cover: { photo: 3, ...COVER } } },
    { style: { font: 'comic' } },
    { style: { cover: { photo: 0, ...COVER, zoom: 0.5 } } },
    { style: { cover: { photo: 0, ...COVER, strength: -0.1 } } },
    { style: { cover: { photo: 0, ...COVER, x: 100.5 } } },
    { style: { colors: { primary: 'red', accent: '#d4af37' } }, colorScheme: 'Custom' },
    { style: { colors: { primary: '#336699', accent: '#d4af37' } } }, // still the named Blush scheme
  ];
  for (const extra of bad) {
    const res = await call('POST', '/api/invitations/manage', { ...editBody({}, ['inv/1/0.png', 'inv/1/1.png']), ...extra }, TOKEN);
    assert.equal(res.status, 400, JSON.stringify(extra));
    assert.deepEqual(style(), s);
    assert.deepEqual(JSON.parse(inv().photos), ['inv/1/0.png', 'inv/1/1.png']);
    assert.equal(r2.map.size, 2);
    assert.equal(JSON.parse(inv().color_scheme).name, 'Blush');
  }
});

test('manage edit without a style: reordering keeps the cover on its photo; removing it drops the cover', async () => {
  const s = { v: 1, font: 'romantic', cover: { photo: 'inv/1/1.png', ...COVER } };
  liveStyled(s);
  assert.equal((await call('POST', '/api/invitations/manage', editBody({}, ['inv/1/1.png', 'inv/1/0.png']), TOKEN)).status, 200);
  assert.deepEqual(style(), s);
  assert.equal((await call('POST', '/api/invitations/manage', editBody({}, ['inv/1/1.png', PNG]), TOKEN)).status, 200);
  assert.deepEqual(style(), s, 'removing another photo keeps the cover');
  const res = await call('POST', '/api/invitations/manage', editBody({}, [JSON.parse(inv().photos)[1]]), TOKEN);
  assert.equal(res.status, 200);
  assert.deepEqual(style(), { v: 1, font: 'romantic' });
  assert.deepEqual((await res.json()).style, { v: 1, font: 'romantic' });
});

test("manage edit switches between a named scheme and 'Custom' plus colours; design changes stay blocked", async () => {
  live();
  const colors = { primary: '#336699', accent: '#d4af37' };
  let res = await call('POST', '/api/invitations/manage', { ...editBody(), colorScheme: 'Custom', style: { v: 1, colors } }, TOKEN);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(inv().color_scheme).name, 'Custom');
  // New colours on a Custom invitation re-derive the scheme
  res = await call('POST', '/api/invitations/manage', { ...editBody(), style: { v: 1, colors: { ...colors, primary: '#884422' } } }, TOKEN);
  assert.equal(res.status, 200);
  const custom = JSON.parse(inv().color_scheme);
  assert.equal(custom.name, 'Custom');
  assert.notEqual(custom.background, JSON.parse(SCHEMES)[0].background);
  for (const bad of [{ colorScheme: 'Custom', style: {} }, { colorScheme: 'Neon', style: {} }, { style: {} }]) {
    res = await call('POST', '/api/invitations/manage', { ...editBody(), ...bad }, TOKEN);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.deepEqual(JSON.parse(inv().color_scheme), custom);
  }
  res = await call('POST', '/api/invitations/manage', { ...editBody(), colorScheme: 'Blush', style: { v: 1 } }, TOKEN);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(inv().color_scheme), JSON.parse(SCHEMES)[0]);
  assert.deepEqual(style(), { v: 1 });
  for (const bad of [{ design: 'garden' }, { designSlug: 'confetti-pop' }]) {
    assert.equal((await call('POST', '/api/invitations/manage', { ...editBody(), ...bad }, TOKEN)).status, 400);
  }
});

test('guest API returns style with the cover as an index into its photos list; {} for an old invitation', async () => {
  const w = live();
  assert.deepEqual((await (await get(`/api/invitations/i/${w.slug}`)).json()).style, {});
  sql('DELETE FROM invitations'); sql('DELETE FROM orders');
  liveStyled({ v: 1, font: 'modern', cover: { photo: 'inv/1/1.png', ...COVER } });
  const g = await (await get(`/api/invitations/i/${w.slug}`)).json();
  assert.deepEqual(g.style, { v: 1, font: 'modern', cover: { photo: 1, ...COVER } });
  assert.equal(g.photos[g.style.cover.photo], '/photos/inv/1/1.png');
  // A stored cover key missing from the photo list is dropped, never pointed elsewhere
  sql(`UPDATE invitations SET photos = '["inv/1/0.png"]'`);
  assert.deepEqual((await (await get(`/api/invitations/i/${w.slug}`)).json()).style, { v: 1, font: 'modern' });
});

// --- Gift QR ---
const manage = (extra) => call('POST', '/api/invitations/manage', { ...editBody(), ...extra }, TOKEN);

test('checkout stores the gift QR at inv/<id>/gift.<ext>; without one gift_qr stays NULL', async () => {
  assert.equal((await post('/api/invitations/checkout', goodCheckout({ giftQr: PNG }))).status, 200);
  assert.equal(inv().gift_qr, 'inv/1/gift.png');
  assert.ok(r2.map.has('inv/1/gift.png'));
  assert.ok(!JSON.parse(inv().photos).includes('inv/1/gift.png'));
});

test('checkout without a gift QR leaves gift_qr NULL', async () => {
  assert.equal((await post('/api/invitations/checkout', goodCheckout())).status, 200);
  assert.equal(inv().gift_qr, null);
});

test('checkout with a bad gift QR → 400 with a clear message and nothing stored', async () => {
  for (const [giftQr, msg] of [['data:text/html;base64,PGI+', 'Gift QR code must be a JPEG, PNG or WebP image.'], [42, 'Gift QR code must be a JPEG, PNG or WebP image.'],
    ['data:image/png;base64,' + 'A'.repeat(3_000_000), 'The gift QR code is too large.']]) {
    const res = await post('/api/invitations/checkout', goodCheckout({ giftQr }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, msg);
  }
  assert.equal(q('SELECT COUNT(*) c FROM invitations')[0].c, 0);
  assert.equal(r2.map.size, 0);
});

test('manage: gift QR is kept when absent, replaced (old extension deleted), then removed (object deleted)', async () => {
  live();
  sql("UPDATE invitations SET gift_qr = 'inv/1/gift.png' WHERE id = 1");
  r2.map.set('inv/1/gift.png', { body: 'qr', bytes: Buffer.from('qr'), httpMetadata: { contentType: 'image/png' } });
  assert.equal((await call('GET', '/api/invitations/manage', undefined, TOKEN).then((r) => r.json())).giftQr, 'inv/1/gift.png');
  let res = await manage({});
  assert.equal(res.status, 200);
  assert.equal(inv().gift_qr, 'inv/1/gift.png');
  assert.ok(r2.map.has('inv/1/gift.png'));
  res = await manage({ giftQr: JPG });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).giftQr, 'inv/1/gift.jpg');
  assert.equal(inv().gift_qr, 'inv/1/gift.jpg');
  assert.ok(r2.map.has('inv/1/gift.jpg') && !r2.map.has('inv/1/gift.png'));
  res = await manage({ giftQr: JPG }); // same extension overwrites in place
  assert.equal(inv().gift_qr, 'inv/1/gift.jpg');
  assert.ok(r2.map.has('inv/1/gift.jpg'));
  res = await manage({ giftQr: null });
  assert.equal(res.status, 200);
  assert.equal(inv().gift_qr, null);
  assert.ok(!r2.map.has('inv/1/gift.jpg'));
  assert.ok(r2.map.has('inv/1/0.png'), 'photos untouched');
});

test('manage: a bad gift QR → 400 and the stored one is untouched', async () => {
  live();
  sql("UPDATE invitations SET gift_qr = 'inv/1/gift.png' WHERE id = 1");
  for (const giftQr of ['data:text/html;base64,PGI+', 'inv/1/other.png', 7]) {
    const res = await manage({ giftQr });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'Gift QR code must be a JPEG, PNG or WebP image.');
  }
  assert.equal(inv().gift_qr, 'inv/1/gift.png');
});

test('manage: sending the stored gift QR key keeps it, and a full save with an existing QR succeeds', async () => {
  live();
  sql("UPDATE invitations SET gift_qr = 'inv/1/gift.png' WHERE id = 1");
  r2.map.set('inv/1/gift.png', { body: 'qr', bytes: Buffer.from('qr'), httpMetadata: { contentType: 'image/png' } });
  let res = await manage({ giftQr: 'inv/1/gift.png' });
  assert.equal(res.status, 200);
  assert.equal(inv().gift_qr, 'inv/1/gift.png');
  assert.ok(r2.map.has('inv/1/gift.png'));
  // what ManagePage sends: details, photos, style, no giftQr
  res = await call('POST', '/api/invitations/manage', { details: JSON.parse(inv().details), photos: ['inv/1/0.png'], style: {} }, TOKEN);
  assert.equal(res.status, 200);
  assert.equal(inv().gift_qr, 'inv/1/gift.png');
});
