// Tests for the guest page (link previews), the public invitation API and photo serving. Run: npm test
// Handlers are bundled with esbuild like tests/invitations-api.test.mjs; D1, R2 and ASSETS are in-memory fakes.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
let page, photo, api;
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jlc-guest-'));
  const bundle = async (entry, name) => {
    const outfile = join(dir, name);
    await build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm',
      outfile, logLevel: 'warning', alias: { 'cloudflare:sockets': join(root, 'tests/smtp-stub.mjs') } });
    return import(pathToFileURL(outfile).href);
  };
  page = (await bundle('functions/i/[slug].ts', 'page.mjs')).onRequestGet;
  photo = (await bundle('functions/photos/[[key]].ts', 'photo.mjs')).onRequestGet;
  api = (await bundle('functions/api/invitations/[[path]].ts', 'inv.mjs')).onRequest;
});

// --- In-memory D1 ---
const SCHEME = { name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' };
let db, updates;
const inv = (id, slug, status, eventDate, details = {}, photos = []) => ({
  id, design_id: 1, slug, status, event_date: eventDate, color_scheme: JSON.stringify(SCHEME), photos: JSON.stringify(photos),
  details: JSON.stringify({ partner1: 'A<b>', partner2: 'Juan "J"', eventDate, eventTime: '15:00', ceremony: { name: 'St. Joseph' }, schedule: [], ...details }),
});
beforeEach(() => {
  updates = [];
  db = [
    inv(1, 'live-one', 'live', '2099-06-12', {}, ['inv/1/0.png', 'inv/1/1.jpg']),
    inv(2, 'refunded-one', 'refunded', '2099-06-12', {}, ['inv/2/0.png']),
    inv(3, 'old-one', 'live', '2020-01-01', {}, ['inv/3/0.png']),
    inv(4, 'pending-one', 'pending', '2099-06-12'),
    inv(5, 'closed-one', 'live', '2099-06-12', { rsvpDeadline: '2020-01-01' }),
  ];
  r2.clear();
  for (const k of ['inv/1/0.png', 'inv/2/0.png', 'inv/3/0.png']) r2.set(k, 'bytes-' + k);
});
function exec(sql, a) {
  if (/^SELECT i\.\*, d.layout_key, d.product_type FROM invitations i JOIN products_designs d ON d\.id = i\.design_id WHERE i\.slug = \?/.test(sql)) {
    const i = db.find(x => x.slug === a[0]);
    return i ? { ...i, layout_key: 'classic', product_type: 'wedding_invitation' } : null;
  }
  if (/^UPDATE invitations SET status = 'expired' WHERE id = \? AND status = 'live'/.test(sql)) {
    updates.push(a[0]);
    const i = db.find(x => x.id === a[0] && x.status === 'live');
    if (i) i.status = 'expired';
    return { meta: { changes: i ? 1 : 0 } };
  }
  if (/^SELECT status, event_date, photos FROM invitations WHERE id = \?/.test(sql)) return db.find(x => x.id === a[0]) ?? null;
  throw new Error('Unexpected SQL: ' + sql);
}
const stmt = (sql) => {
  const q = { args: [], bind(...a) { q.args = a; return q; },
    async first() { return exec(sql, q.args); }, async all() { return exec(sql, q.args); }, async run() { return exec(sql, q.args); } };
  return q;
};
const DB = { prepare: stmt };

// --- Fake R2 and ASSETS ---
const r2 = new Map();
const PHOTOS = {
  async get(key) {
    const v = r2.get(key);
    return v === undefined ? null : { body: v, httpMetadata: { contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' } };
  },
};
const SHELL = '<!doctype html><html><head><meta charset="utf-8"><title>Wedding invitation</title><!--og-tags--></head><body><div id="root"></div></body></html>';
const assetsFetched = [];
const ASSETS = { async fetch(u) { assetsFetched.push(String(u)); return new Response(SHELL, { headers: { 'Content-Type': 'text/html' } }); } };

const ctx = (fn, path, params = {}) => fn({ request: new Request('https://shop.test' + path), env: { DB, PHOTOS, ASSETS }, params, waitUntil() {} });
const view = async (slug) => { const res = await ctx(page, `/i/${slug}`, { slug }); return { res, html: await res.text() }; };
const og = (html, prop) => html.match(new RegExp(`<meta property="og:${prop}" content="([^"]*)">`))?.[1];

// --- Guest page ---
test('live slug: escaped names in og:title and <title>, absolute og:image of the first photo', async () => {
  const { res, html } = await view('live-one');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/html/);
  assert.equal(assetsFetched.at(-1), 'https://shop.test/invitation');
  assert.ok(og(html, 'title').includes('A&lt;b&gt; &amp; Juan &quot;J&quot;'), og(html, 'title'));
  assert.ok(!html.includes('A<b>'), 'raw name never appears');
  assert.match(html, /<title>[^<]*A&lt;b&gt;[^<]*<\/title>/);
  assert.ok(!html.includes('<title>Wedding invitation</title>'));
  assert.ok(!html.includes('<!--og-tags-->'));
  assert.equal(og(html, 'image'), 'https://shop.test/photos/inv/1/0.png');
  assert.ok(og(html, 'description'));
  assert.match(html, /<meta name="description" content="[^"]+">/);
});

test('live slug: the wedding date is in og:title and <title>', async () => {
  const { html } = await view('live-one');
  const title = 'A&lt;b&gt; &amp; Juan &quot;J&quot; — June 12, 2099';
  assert.equal(og(html, 'title'), title);
  assert.ok(html.includes(`<title>${title}</title>`));
});

test('guest page responses carry the same security headers as public/_headers', async () => {
  // Pages does not apply _headers to Function responses
  const expected = readFileSync(join(root, 'public/_headers'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
    .map((l) => l.trim().match(/^([^:]+):\s*(.*)$/).slice(1));
  assert.equal(expected.length, 4);
  for (const slug of ['live-one', 'nope']) {
    const { res } = await view(slug);
    for (const [name, value] of expected) assert.equal(res.headers.get(name), value, `${slug} ${name}`);
  }
});

test('refunded slug → 404, no partner name in the HTML', async () => {
  const { res, html } = await view('refunded-one');
  assert.equal(res.status, 404);
  assert.ok(!html.includes('A&lt;b&gt;') && !html.includes('Juan'));
  assert.equal(og(html, 'title'), 'Invitation not available');
  assert.equal(og(html, 'image'), undefined);
});

test('expired slug → 200 with "celebration has passed", no og:image, status updated', async () => {
  const { res, html } = await view('old-one');
  assert.equal(res.status, 200);
  assert.ok(og(html, 'title').includes('celebration has passed'));
  assert.equal(og(html, 'image'), undefined);
  assert.equal(db[2].status, 'expired');
});

test('unknown, pending and malformed slugs → 404', async () => {
  for (const slug of ['nope', 'pending-one', '%E0%A4%A']) {
    const { res, html } = await view(slug);
    assert.equal(res.status, 404, slug);
    assert.equal(og(html, 'title'), 'Invitation not available');
  }
});

test('shell fetch fails → plain 502, not a rewritten 200', async () => {
  const fetch = ASSETS.fetch;
  ASSETS.fetch = async () => new Response('Not found', { status: 404 });
  try {
    const { res, html } = await view('live-one');
    assert.equal(res.status, 502);
    assert.ok(!html.includes('og:'));
  } finally { ASSETS.fetch = fetch; }
});

// --- Public invitation API ---
test('API: live → layout, colors, details, photo URLs, rsvpOpen', async () => {
  const res = await ctx(api, '/api/invitations/i/live-one');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ['askKids', 'colorScheme', 'details', 'layoutKey', 'photos', 'productType', 'rsvpOpen', 'state']);
  assert.equal(data.state, 'live');
  assert.equal(data.layoutKey, 'classic');
  assert.deepEqual(data.colorScheme, SCHEME);
  assert.equal(data.details.partner1, 'A<b>');
  assert.deepEqual(data.photos, ['/photos/inv/1/0.png', '/photos/inv/1/1.jpg']);
  assert.equal(data.rsvpOpen, true);
  assert.equal((await (await ctx(api, '/api/invitations/i/closed-one')).json()).rsvpOpen, false);
});

test('API: rsvpOpen is true on the deadline day itself (UTC)', async () => {
  db[4].details = JSON.stringify({ ...JSON.parse(db[4].details), rsvpDeadline: new Date().toISOString().slice(0, 10) });
  assert.equal((await (await ctx(api, '/api/invitations/i/closed-one')).json()).rsvpOpen, true);
});

test('API: past event + 60 days → expired shape (title only) and one lazy UPDATE', async () => {
  const res = await ctx(api, '/api/invitations/i/old-one');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { state: 'expired', title: 'A<b> & Juan "J"' });
  assert.deepEqual(updates, [3]);
  assert.equal(db[2].status, 'expired');
  // Already expired: same shape, no further UPDATE
  assert.deepEqual(await (await ctx(api, '/api/invitations/i/old-one')).json(), { state: 'expired', title: 'A<b> & Juan "J"' });
  assert.deepEqual(updates, [3]);
});

test('API: event exactly 60 days ago is still live', async () => {
  const d = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  db[0].event_date = d;
  assert.equal((await (await ctx(api, '/api/invitations/i/live-one')).json()).state, 'live');
});

test('API: refunded, pending, unknown and malformed slugs → 404', async () => {
  for (const slug of ['refunded-one', 'pending-one', 'nope', '%E0%A4%A']) {
    const res = await ctx(api, `/api/invitations/i/${slug}`);
    assert.equal(res.status, 404, slug);
    assert.deepEqual(await res.json(), { error: 'Invitation not found.' });
  }
});

// --- Photos ---
test('photo of a live invitation → body, content type and a day of caching', async () => {
  const res = await ctx(photo, '/photos/inv/1/0.png', { key: ['inv', '1', '0.png'] });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'bytes-inv/1/0.png');
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('photo of a refunded invitation → 404', async () => {
  const res = await ctx(photo, '/photos/inv/2/0.png', { key: ['inv', '2', '0.png'] });
  assert.equal(res.status, 404);
});

test('photo: expired invitation, key not in the list, missing object, bad paths → 404', async () => {
  r2.set('inv/1/9.png', 'orphan');
  for (const p of ['/photos/inv/3/0.png', '/photos/inv/1/9.png', '/photos/inv/1/1.jpg', '/photos/inv/99/0.png', '/photos/other/0.png', '/photos/%E0%A4%A', '/photos/']) {
    const res = await ctx(photo, p);
    assert.equal(res.status, 404, p);
  }
});
