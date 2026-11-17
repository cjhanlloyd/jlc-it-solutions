// Tests for guest links: the manage guests API, ?g= on the guest API and guestToken on the RSVP. Run: npm test
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
const SCHEME = JSON.stringify({ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' });
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } };

let db, r2;
beforeEach(() => {
  db = makeD1(); r2 = makeR2();
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type)
    VALUES (1, 'classic', 'Classic', 'classic', 99900, '[${SCHEME}]', 1, 0, 'wedding_invitation');`);
  inv(1); inv(2);
  db.exec.prepare("INSERT INTO customer_sessions (token_hash, email, expires_at) VALUES (?, 'bride@example.com', '2999-01-01T00:00:00.000Z')").run(hash('sess'));
  db.exec.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference) VALUES (1, 'bride@example.com', 99900, 'delivered', 'JLC-1')").run();
});
const inv = (id) => db.exec.prepare(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier)
  VALUES (?, 1, ?, ?, ?, '[]', 'live', '2027-06-12', ?, 'premium')`).run(id, `maria-${id}`, SCHEME, JSON.stringify(details), hash(`mt-${id}`));
const q = (s, ...a) => db.exec.prepare(s).all(...a).map((r) => ({ ...r }));
const call = (method, path, body, headers = {}) => invitations({
  request: new Request('https://shop.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
  env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 'turnstile-secret' }, waitUntil() {},
});
const M1 = { 'X-Manage-Token': 'mt-1' };
const SESSION = { 'X-Customer-Token': 'sess', 'X-Invitation-Id': '1' };
const act = (body, headers = M1) => call('POST', '/api/invitations/manage/guests', body, headers);
const add = async (name, seats = 2, headers = M1) => (await (await act({ action: 'add', name, seats }, headers)).json());
const rsvp = (slug, body) => call('POST', `/api/invitations/i/${slug}/rsvp`, { guestName: 'Someone', attending: true, partySize: 1, turnstileToken: 'good-token', ...body });
const view = async (slug, g) => (await call('GET', `/api/invitations/i/${slug}` + (g ? `?g=${g}` : ''))).json();

test('add, list (by name), update and delete with the manage token', async () => {
  const a = await add('bea cruz', 2);
  assert.match(a.token, /^[A-Za-z0-9_-]{12}$/);
  const b = await add('  Al Reyes ', 3);
  const list = await (await call('GET', '/api/invitations/manage/guests', undefined, M1)).json();
  assert.deepEqual(list.guests.map((g) => [g.name, g.seats, g.rsvp]), [['Al Reyes', 3, null], ['bea cruz', 2, null]]);
  assert.equal(list.guests[1].token, a.token);
  assert.equal((await act({ action: 'update', id: a.id, name: 'Bea C', seats: 4 })).status, 200);
  assert.equal((await act({ action: 'update', id: a.id, seats: 5 })).status, 200);
  assert.equal((await rsvp('maria-1', { guestToken: a.token, partySize: 1 })).status, 200);
  assert.equal((await act({ action: 'update', id: a.id, name: 'Bea Cruz' })).status, 200);
  assert.deepEqual(q('SELECT guest_name FROM rsvps'), [{ guest_name: 'Bea Cruz' }]);
  assert.deepEqual(q('SELECT name, seats FROM invitation_guests WHERE id = ?', a.id), [{ name: 'Bea Cruz', seats: 5 }]);
  assert.equal((await act({ action: 'delete', id: b.id })).status, 200);
  assert.equal(q('SELECT * FROM invitation_guests').length, 1);
});

test('the same works through a customer session; no credentials or another customer give 404', async () => {
  const g = await add('Cy', 2, SESSION);
  assert.ok(g.token);
  const list = await (await call('GET', '/api/invitations/manage/guests', undefined, SESSION)).json();
  assert.equal(list.guests.length, 1);
  assert.equal((await call('GET', '/api/invitations/manage/guests')).status, 404);
  assert.equal((await act({ action: 'add', name: 'X', seats: 1 }, { ...SESSION, 'X-Invitation-Id': '2' })).status, 404);
});

test('a guest id from another invitation gives 404 and changes nothing', async () => {
  const other = await add('Dee', 2, { 'X-Manage-Token': 'mt-2' });
  assert.equal((await act({ action: 'update', id: other.id, name: 'Hacked' })).status, 404);
  assert.equal((await act({ action: 'delete', id: other.id })).status, 404);
  assert.deepEqual(q('SELECT name FROM invitation_guests WHERE id = ?', other.id), [{ name: 'Dee' }]);
});

test('validation errors', async () => {
  for (const b of [{ name: '', seats: 1 }, { name: '   ', seats: 1 }, { name: 'x'.repeat(81), seats: 1 }, { name: 'A', seats: 0 }, { name: 'A', seats: 11 }, { name: 'A', seats: 1.5 }, { name: 'A', seats: '2' }, { name: 'A' }, { seats: 2 }]) {
    assert.equal((await act({ action: 'add', ...b })).status, 400, JSON.stringify(b));
  }
  assert.equal((await act({ action: 'add', name: 'x'.repeat(80), seats: 10 })).status, 200);
  assert.equal((await act({ action: 'nope', id: 1 })).status, 400);
  assert.equal((await act({ action: 'update', id: 1 })).status, 400);
  assert.equal((await act({ action: 'update', id: 999, seats: 2 })).status, 404);
});

test('at most 300 guests per invitation', async () => {
  db.exec.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300)
    INSERT INTO invitation_guests (invitation_id, token, name, seats) SELECT 1, 'tok' || i, 'G' || i, 1 FROM n;`);
  const res = await act({ action: 'add', name: 'One too many', seats: 1 });
  assert.equal(res.status, 400);
  assert.equal(q('SELECT COUNT(*) AS c FROM invitation_guests WHERE invitation_id = 1')[0].c, 300);
  assert.equal((await act({ action: 'add', name: 'Elsewhere', seats: 1 }, { 'X-Manage-Token': 'mt-2' })).status, 200);
});

test('guest API: own token adds guest, foreign or unknown token does not', async () => {
  const a = await add('Eve', 3);
  const b = await add('Fay', 2, { 'X-Manage-Token': 'mt-2' });
  assert.deepEqual((await view('maria-1', a.token)).guest, { name: 'Eve', seats: 3, rsvp: null });
  assert.equal('guest' in await view('maria-1', b.token), false);
  assert.equal('guest' in await view('maria-1', 'nonsense'), false);
  assert.equal('guest' in await view('maria-1'), false);
});

test('guest RSVP: name is forced, seat cap holds, a second RSVP replaces the first', async () => {
  const a = await add('Eve', 3);
  const over = await (await rsvp('maria-1', { guestToken: a.token, partySize: 4 })).json();
  assert.equal(over.error, 'You can reply for up to 3 guests in total.');
  assert.equal((await rsvp('maria-1', { guestToken: a.token, guestName: 'Spoofed', partySize: 2 })).status, 200);
  assert.equal((await rsvp('maria-1', { guestToken: a.token, guestName: 'Spoofed', attending: false })).status, 200);
  const rows = q('SELECT guest_name, attending, guest_id FROM rsvps');
  assert.deepEqual(rows, [{ guest_name: 'Eve', attending: 0, guest_id: a.id }]);
  assert.deepEqual((await view('maria-1', a.token)).guest.rsvp, { attending: false, partySize: 1, kidsCount: 0, message: '' });
  const list = await (await call('GET', '/api/invitations/manage/guests', undefined, M1)).json();
  assert.equal(list.guests[0].rsvp.attending, false);
  const manage = await (await call('GET', '/api/invitations/manage', undefined, M1)).json();
  assert.equal(manage.rsvps[0].guestId, a.id);
});

test('a replacement is not blocked when the invitation already has 300 replies', async () => {
  const a = await add('Eve', 3);
  assert.equal((await rsvp('maria-1', { guestToken: a.token })).status, 200);
  db.exec.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 299)
    INSERT INTO rsvps (invitation_id, guest_name, attending, party_size) SELECT 1, 'G' || i, 1, 1 FROM n;`);
  assert.equal(q('SELECT COUNT(*) AS c FROM rsvps WHERE invitation_id = 1')[0].c, 300);
  assert.equal((await rsvp('maria-1', { guestToken: a.token, partySize: 2 })).status, 200);
  assert.equal(q('SELECT COUNT(*) AS c FROM rsvps WHERE invitation_id = 1')[0].c, 300);
  assert.equal((await rsvp('maria-1', { guestName: 'General' })).status, 400); // a general reply is still capped
});

test('an unknown or foreign guestToken is a general RSVP', async () => {
  const b = await add('Fay', 1, { 'X-Manage-Token': 'mt-2' });
  assert.equal((await rsvp('maria-1', { guestToken: b.token, guestName: 'Walk-in', partySize: 5 })).status, 200);
  assert.equal((await rsvp('maria-1', { guestToken: 'nope', guestName: 'Walk-in 2' })).status, 200);
  assert.deepEqual(q('SELECT guest_name, guest_id FROM rsvps ORDER BY id'), [{ guest_name: 'Walk-in', guest_id: null }, { guest_name: 'Walk-in 2', guest_id: null }]);
});

test('deleting a guest keeps their reply as a general one and the token shows the general invitation', async () => {
  const a = await add('Eve', 3);
  await rsvp('maria-1', { guestToken: a.token, partySize: 2 });
  assert.equal((await act({ action: 'delete', id: a.id })).status, 200);
  assert.deepEqual(q('SELECT guest_name, party_size, guest_id FROM rsvps'), [{ guest_name: 'Eve', party_size: 2, guest_id: null }]);
  assert.equal('guest' in await view('maria-1', a.token), false);
  assert.equal((await rsvp('maria-1', { guestToken: a.token, guestName: 'Eve again', partySize: 9 })).status, 200);
  assert.equal(q('SELECT * FROM rsvps').length, 2);
});

test('expired invitations ignore g', async () => {
  const a = await add('Eve', 3);
  db.exec.exec("UPDATE invitations SET status = 'expired' WHERE id = 1");
  const data = await view('maria-1', a.token);
  assert.equal(data.state, 'expired');
  assert.equal('guest' in data, false);
});

test('birthday guest: adults plus kids must fit the seats; declining is always allowed', async () => {
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type)
    VALUES (3, 'confetti', 'Confetti', 'confetti', 99900, '[${SCHEME}]', 1, 0, 'birthday_invitation');
    INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier)
    VALUES (3, 3, 'mia-3', '${SCHEME}', '${JSON.stringify({ celebrant: 'Mia', age: 7, eventDate: '2027-06-12', venue: { name: 'Fun Hall' } })}', '[]', 'live', '2027-06-12', '${hash('mt-3')}', 'premium');`);
  const a = await add('Gil', 2, { 'X-Manage-Token': 'mt-3' });
  const res = await rsvp('mia-3', { guestToken: a.token, partySize: 2, kidsCount: 1 });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'You can reply for up to 2 guests in total.');
  assert.equal((await rsvp('mia-3', { guestToken: a.token, partySize: 1, kidsCount: 3 })).status, 400);
  assert.equal((await rsvp('mia-3', { guestToken: a.token, partySize: 1, kidsCount: 1 })).status, 200);
  assert.equal((await rsvp('mia-3', { guestToken: a.token, attending: false, partySize: 5, kidsCount: 5 })).status, 200);
  assert.equal(q('SELECT COUNT(*) AS c FROM rsvps WHERE invitation_id = 3')[0].c, 1);
  // round trip: the guest API returns what they replied, so the form can prefill it
  const b = await add('Hal', 4, { 'X-Manage-Token': 'mt-3' });
  await rsvp('mia-3', { guestToken: b.token, partySize: 2, kidsCount: 1, message: 'See you there' });
  assert.deepEqual((await view('mia-3', b.token)).guest.rsvp, { attending: true, partySize: 2, kidsCount: 1, message: 'See you there' });
});
