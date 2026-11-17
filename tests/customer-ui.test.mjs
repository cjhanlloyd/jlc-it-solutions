// Pure helpers behind the account page, the guest links list and the guest RSVP seat cap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyAllText, guestLink, guestStatus, guestSummary, seatOptions } from '../src/invitations/customer-ui.ts';

const guests = [
  { id: 1, name: 'Tita Rosa', seats: 2, token: 'abc_DEF-123x', rsvp: { attending: true, partySize: 1, kidsCount: 1 } },
  { id: 2, name: 'Ben', seats: 1, token: 'zzzzzzzzzzzz', rsvp: { attending: false, partySize: 1, kidsCount: 0 } },
  { id: 3, name: 'Ana', seats: 4, token: 'aaaaaaaaaaaa', rsvp: null },
];

test('guestLink builds the personal link', () => {
  assert.equal(guestLink('https://shop.test', 'maria-juan', 'abc_DEF-123x'), 'https://shop.test/i/maria-juan?g=abc_DEF-123x');
});

test('copyAllText gives one "Name: url" line per guest', () => {
  assert.equal(copyAllText(guests, 'https://shop.test', 'mj'), [
    'Tita Rosa: https://shop.test/i/mj?g=abc_DEF-123x',
    'Ben: https://shop.test/i/mj?g=zzzzzzzzzzzz',
    'Ana: https://shop.test/i/mj?g=aaaaaaaaaaaa',
  ].join('\n'));
  assert.equal(copyAllText([], 'https://shop.test', 'mj'), '');
});

test('guestStatus labels each reply, counting kids in the party', () => {
  assert.deepEqual(guests.map(guestStatus), ['Attending · 2', "Can't make it", 'Not replied yet']);
  assert.equal(guestStatus({ rsvp: { attending: true, partySize: 3 } }), 'Attending · 3');
});

test('guestSummary counts guests and replies', () => {
  assert.equal(guestSummary(guests), '3 guests · 2 replied');
  assert.equal(guestSummary([guests[2]]), '1 guest · 0 replied');
});

test('seatOptions caps adults plus kids at the seats', () => {
  assert.deepEqual(seatOptions(1, 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // general link
  assert.deepEqual(seatOptions(1, 10, 3), [1, 2, 3]);
  assert.deepEqual(seatOptions(1, 10, 3, 1), [1, 2]); // 1 kid already chosen
  assert.deepEqual(seatOptions(0, 10, 3, 2), [0, 1]); // kids with 2 adults
  assert.deepEqual(seatOptions(1, 10, 1, 1), [1]); // never below the minimum
  assert.deepEqual(seatOptions(0, 5, 10), [0, 1, 2, 3, 4, 5]); // the field's own limit still applies
});
