// QR check-in (Premium): entry passes, the door key, door-phone check-in and the organiser monitor. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';
import { qrPath, QUIET } from '../src/invitations/qr.ts';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');
const { onRequest: door } = await bundle('functions/api/checkin/[[path]].ts');

const hash = (s) => createHash('sha256').update(s).digest('hex');
const SCHEME = JSON.stringify({ name: 'Blush', primary: '#b76e79', accent: '#d4af37', background: '#fff8f6', text: '#3b2a2e' });
const ON = JSON.stringify({ checkin: { enabled: true } });
const IP = { 'CF-Connecting-IP': '9.9.9.9' };

let db, r2;
const x = (s, ...a) => db.exec.prepare(s).run(...a);
const q = (s, ...a) => db.exec.prepare(s).all(...a).map((r) => ({ ...r }));
const inv = (id, tier, extras) => x(`INSERT INTO invitations (id, design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier, extras)
  VALUES (?, 1, ?, ?, '{"partner1":"Maria","partner2":"Juan","eventDate":"2099-06-12"}', '[]', 'live', '2099-06-12', ?, ?, ?)`, id, `s-${id}`, SCHEME, hash(`mt-${id}`), tier, extras);
const guest = (id, invId, name, seats, token, code) => x('INSERT INTO invitation_guests (id, invitation_id, name, seats, token, checkin_code) VALUES (?, ?, ?, ?, ?, ?)', id, invId, name, seats, token, code);
beforeEach(() => {
  db = makeD1(); r2 = makeR2();
  x(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, active, sort_order, product_type) VALUES (1, 'classic', 'Classic', 'classic', 99900, '[${SCHEME}]', 1, 0, 'wedding_invitation')`);
  inv(1, 'premium', ON); inv(2, 'premium', ON); inv(3, 'standard', '{}'); inv(4, 'premium', '{}');
  guest(7, 1, 'Tita Linda', 3, 'gtok7', 'CODE7777777777AA'); guest(8, 1, 'Kuya Ben', 2, 'gtok8', 'CODE8888888888AA'); guest(9, 2, 'Other Guest', 2, 'gtok9', 'CODE9999999999AA');
  x("INSERT INTO rsvps (invitation_id, guest_name, attending, party_size, kids_count, message, guest_id) VALUES (1, 'Tita Linda', 1, 2, 1, '', 7)");
});

const call = (method, path, body, headers = {}) => invitations({
  request: new Request('https://shop.test' + path, { method, headers: { ...IP, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env: { DB: db, PHOTOS: r2 }, waitUntil() {},
});
const M = (id = 1) => ({ 'X-Manage-Token': `mt-${id}` });
const doorCall = (method, path, body, ip = '9.9.9.9') => door({ request: new Request('https://shop.test' + path, { method, headers: { 'CF-Connecting-IP': ip }, body: body === undefined ? undefined : JSON.stringify(body) }), env: { DB: db } });
const newKey = async (id = 1) => (await (await call('POST', '/api/invitations/manage/checkin/key', {}, M(id))).json());
const scan = (code, key, invitationId = 1, ip) => doorCall('POST', '/api/checkin', { code, invitationId, key }, ip);

test('the pass is only for an attending guest of a Premium invitation with check-in on', async () => {
  const pass = (await (await call('GET', '/api/invitations/i/s-1?g=gtok7')).json()).pass;
  assert.equal(pass.url, 'https://shop.test/c/CODE7777777777AA');
  assert.equal(pass.name, 'Tita Linda');
  assert.equal(pass.partySize, 3); // 2 adults + 1 kid
  assert.equal((await (await call('GET', '/api/invitations/i/s-1?g=gtok8')).json()).pass, undefined); // no reply yet
  assert.equal((await (await call('GET', '/api/invitations/i/s-1')).json()).pass, undefined); // no guest link
  x("UPDATE rsvps SET attending = 0 WHERE guest_id = 7");
  assert.equal((await (await call('GET', '/api/invitations/i/s-1?g=gtok7')).json()).pass, undefined); // declined
  x("UPDATE rsvps SET attending = 1 WHERE guest_id = 7");
  x("UPDATE invitations SET extras = '{}' WHERE id = 1");
  assert.equal((await (await call('GET', '/api/invitations/i/s-1?g=gtok7')).json()).pass, undefined); // check-in off
  x("UPDATE invitations SET extras = ?, tier = 'standard' WHERE id = 1", ON);
  assert.equal((await (await call('GET', '/api/invitations/i/s-1?g=gtok7')).json()).pass, undefined); // not Premium
});

test('codes: new guests get one, existing guests get one lazily', async () => {
  const add = await (await call('POST', '/api/invitations/manage/guests', { action: 'add', name: 'New Guest', seats: 2 }, M())).json();
  assert.match(q('SELECT checkin_code AS c FROM invitation_guests WHERE id = ?', add.id)[0].c, /^[A-Za-z0-9_-]{16}$/);
  x('UPDATE invitation_guests SET checkin_code = NULL WHERE id = 7');
  const pass = (await (await call('GET', '/api/invitations/i/s-1?g=gtok7')).json()).pass;
  assert.match(pass.url, /\/c\/[A-Za-z0-9_-]{16}$/);
});

test('the door key is shown once and only its hash is stored; regenerate replaces it; revoke ends it', async () => {
  const k = await newKey();
  assert.equal(k.invitationId, 1);
  assert.equal(q('SELECT checkin_key_hash AS h FROM invitations WHERE id = 1')[0].h, hash(k.key));
  assert.equal(JSON.stringify(q('SELECT * FROM invitations WHERE id = 1')).includes(k.key), false);
  assert.equal((await (await call('GET', '/api/invitations/manage/checkin', undefined, M())).json()).hasKey, true);
  assert.equal((await (await call('GET', '/api/invitations/manage/checkin', undefined, M())).text()).includes(k.key), false);
  const k2 = await newKey();
  assert.notEqual(k2.key, k.key);
  assert.equal((await scan('CODE7777777777AA', k.key)).status, 401);
  assert.equal((await scan('CODE7777777777AA', k2.key)).status, 200);
  assert.equal((await call('POST', '/api/invitations/manage/checkin/key/revoke', {}, M())).status, 200);
  assert.equal(q('SELECT checkin_key_hash AS h FROM invitations WHERE id = 1')[0].h, null);
  assert.equal((await scan('CODE8888888888AA', k2.key)).status, 401);
  assert.equal((await doorCall('POST', '/api/checkin/verify', { invitationId: 1, key: k2.key })).status, 401);
});

test('check-in needs the right key; another invitation\'s code is not found; double scans say already', async () => {
  const k = await newKey();
  assert.equal((await scan('CODE7777777777AA', 'wrong-key')).status, 401);
  assert.equal((await scan('CODE7777777777AA', k.key, 2)).status, 401); // key of invitation 1 on invitation 2
  assert.equal(q('SELECT checked_in_at FROM invitation_guests WHERE id = 7')[0].checked_in_at, null);
  const ok = await scan('CODE7777777777AA', k.key);
  assert.deepEqual(await ok.json(), { status: 'checked_in', name: 'Tita Linda', party: 3 });
  const again = await (await scan('CODE7777777777AA', k.key)).json();
  assert.equal(again.status, 'already');
  assert.equal(again.name, 'Tita Linda');
  assert.ok(again.at);
  const foreign = await scan('CODE9999999999AA', k.key); // belongs to invitation 2
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).status, 'not_found');
  assert.equal(q('SELECT checked_in_at FROM invitation_guests WHERE id = 9')[0].checked_in_at, null);
  assert.equal((await scan('nope', k.key)).status, 404);
  // no reply: the seats held count
  assert.equal((await (await scan('CODE8888888888AA', k.key)).json()).party, 2);
  assert.equal((await doorCall('POST', '/api/checkin/verify', { invitationId: 1, key: k.key })).status, 200);
});

test('check-in is refused when it is switched off or the invitation is not Premium', async () => {
  const k = await newKey();
  x("UPDATE invitations SET extras = '{}' WHERE id = 1");
  assert.equal((await scan('CODE7777777777AA', k.key)).status, 401);
  assert.equal((await call('POST', '/api/invitations/manage/checkin/key', {}, M(3))).status, 403);
  assert.equal((await call('GET', '/api/invitations/manage/checkin', undefined, M(3))).status, 403);
});

test('unauthenticated door requests write nothing', async () => {
  const before = q('SELECT COUNT(*) AS n FROM audit_logs')[0].n;
  for (let i = 0; i < 5; i++) await scan('CODE7777777777AA', 'wrong-key');
  await doorCall('POST', '/api/checkin/verify', { invitationId: 1, key: 'wrong-key' });
  await doorCall('GET', '/api/checkin/pass/CODE7777777777AA');
  assert.equal(q('SELECT COUNT(*) AS n FROM audit_logs')[0].n, before);
  assert.equal(q('SELECT checked_in_at FROM invitation_guests WHERE id = 7')[0].checked_in_at, null);
  const k = await newKey();
  for (let i = 0; i < 130; i++) await scan('nope', k.key, 1, '5.5.5.5'); // authorised phones are never throttled
  assert.equal((await scan('CODE7777777777AA', k.key, 1, '5.5.5.5')).status, 200);
  assert.equal(q('SELECT COUNT(*) AS n FROM audit_logs')[0].n, before);
});

test('the pass page reveals only the name and the event', async () => {
  const res = await doorCall('GET', '/api/checkin/pass/CODE7777777777AA');
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ['name', 'title']);
  assert.equal(body.name, 'Tita Linda');
  assert.match(body.title, /Maria/);
  assert.equal((await doorCall('GET', '/api/checkin/pass/unknown')).status, 404);
  assert.equal((await doorCall('GET', '/api/checkin/pass/%E0')).status, 404);
});

test('organiser monitor: totals, manual check-in and undo; a foreign guest is 404', async () => {
  const get = async () => (await call('GET', '/api/invitations/manage/checkin', undefined, M())).json();
  let d = await get();
  assert.deepEqual(d.totals, { attendingGuests: 1, checkedInGuests: 0, expectedPeople: 3, checkedInPeople: 0 });
  assert.deepEqual(d.guests.map((g) => [g.name, g.rsvp, g.party]), [['Kuya Ben', null, 2], ['Tita Linda', 'attending', 3]]);
  assert.equal((await call('POST', '/api/invitations/manage/checkin/mark', { guestId: 7 }, M())).status, 200);
  d = await get();
  assert.equal(d.totals.checkedInGuests, 1);
  assert.equal(d.totals.checkedInPeople, 3);
  assert.ok(d.guests.find((g) => g.id === 7).checkedInAt);
  assert.equal((await call('POST', '/api/invitations/manage/checkin/mark', { guestId: 7, undo: true }, M())).status, 200);
  d = await get();
  assert.equal(d.totals.checkedInGuests, 0);
  assert.equal(d.totals.checkedInPeople, 0);
  assert.equal((await call('POST', '/api/invitations/manage/checkin/mark', { guestId: 9 }, M())).status, 404); // invitation 2's guest
  assert.equal(q('SELECT checked_in_at FROM invitation_guests WHERE id = 9')[0].checked_in_at, null);
  assert.equal((await call('GET', '/api/invitations/manage/checkin')).status, 404); // no credentials
});

test('the QR path builder gives a matrix for a URL with a quiet zone', () => {
  const { size, d } = qrPath('https://shop.test/c/CODE7777777777AA');
  assert.ok(size > QUIET * 2 + 20);
  assert.match(d, /^M\d+ \d+h1v1h-1z/);
  const cells = [...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(cells.length > 100);
  assert.ok(cells.every(([cx, cy]) => cx >= QUIET && cy >= QUIET && cx < size - QUIET && cy < size - QUIET));
  assert.equal(qrPath('https://shop.test/c/CODE7777777777AA').d, d); // deterministic
  assert.notEqual(qrPath('https://shop.test/c/CODE8888888888AA').d, d);
});
