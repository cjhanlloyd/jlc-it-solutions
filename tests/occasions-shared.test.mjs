import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthday } from '../shared/occasions/birthday.ts';
import { wedding } from '../shared/occasions/wedding.ts';
import { occasionOf } from '../shared/occasions/index.ts';
import { makeSlug, validateRsvp } from '../shared/invitation-fields.ts';

const bd = (o = {}) => ({ celebrant: ' Mia ', eventDate: '2027-03-14', venue: { name: 'Party Room' }, ...o });

test('birthday valid minimal', () => {
  const r = birthday.validateDetails(bd());
  assert.equal(r.ok, true);
  assert.equal(r.details.celebrant, 'Mia');
  assert.equal('age' in r.details, false);
  assert.deepEqual(r.details.schedule, []);
});

test('birthday rejects', () => {
  const { celebrant, ...noName } = bd();
  const cases = [
    noName, bd({ age: 0 }), bd({ age: 121 }), bd({ age: 7.5 }), bd({ age: '7' }),
    bd({ venue: { address: 'x' } }),
    bd({ schedule: Array.from({ length: 9 }, () => ({ time: '10:00', label: 'x' })) }),
    bd({ theme: 'x'.repeat(81) }),
    bd({ venue: { name: 'P', mapUrl: 'javascript:x' } }),
  ];
  cases.forEach((c, n) => assert.equal(birthday.validateDetails(c).ok, false, `case ${n}`));
});

test('birthday keeps optional fields', () => {
  const r = birthday.validateDetails(bd({
    age: 7, headline: ' H ', theme: ' T ', hostedBy: ' B ', dressCode: ' D ', giftsNote: ' G ', message: ' M ',
    rsvpDeadline: '2027-03-01', schedule: [{ time: '10:00', label: ' Games ' }], evil: 1,
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.details, {
    celebrant: 'Mia', eventDate: '2027-03-14', eventTime: '', venue: { name: 'Party Room', address: '', mapUrl: '' },
    schedule: [{ time: '10:00', label: 'Games' }], age: 7, headline: 'H', theme: 'T', hostedBy: 'B', dressCode: 'D', giftsNote: 'G', message: 'M', rsvpDeadline: '2027-03-01',
  });
});

test('titles', () => {
  assert.equal(birthday.title({ celebrant: 'Mia', age: 7 }), "Mia's 7th Birthday");
  assert.equal(birthday.title({ celebrant: 'Roberto' }), "Roberto's Birthday");
  const sfx = { 21: 'st', 22: 'nd', 23: 'rd', 11: 'th', 12: 'th', 13: 'th', 111: 'th' };
  for (const [n, s] of Object.entries(sfx)) assert.equal(birthday.title({ celebrant: 'X', age: +n }), `X's ${n}${s} Birthday`);
  assert.equal(wedding.title({ partner1: 'Ana', partner2: 'Ben' }), 'Ana & Ben');
});

test('slug bases', () => {
  assert.equal(makeSlug(birthday.slugBase({ celebrant: 'Mía', age: 7 }), 'k3x9'), 'mia-7th-birthday-k3x9');
  assert.equal(makeSlug(birthday.slugBase({ celebrant: 'Roberto' }), 'k3x9'), 'roberto-birthday-k3x9');
  assert.equal(makeSlug(wedding.slugBase({ partner1: 'Maria', partner2: 'Juan' }), 'k3x9'), 'maria-and-juan-k3x9');
});

test('locked', () => {
  assert.equal(birthday.lockedFieldsChanged({ celebrant: 'A', eventDate: '1' }, { celebrant: 'B', eventDate: '1' }), true);
  assert.equal(birthday.lockedFieldsChanged({ celebrant: 'A', eventDate: '1' }, { celebrant: 'A', eventDate: '2' }), false);
  assert.doesNotMatch(birthday.lockedMessage, /Names/);
});

test('expired summaries', () => {
  const w = { partner1: 'Ana', partner2: 'Ben', eventDate: '2027-01-01' };
  assert.deepEqual(wedding.expiredSummary(w), { partner1: 'Ana', partner2: 'Ben', _purged: true });
  assert.equal(wedding.title(wedding.expiredSummary(w)), wedding.title(w));
  const b = { celebrant: 'Mia', age: 7 };
  assert.deepEqual(birthday.expiredSummary(b), { celebrant: 'Mia', age: 7, _purged: true });
  assert.deepEqual(birthday.expiredSummary({ celebrant: 'Mia' }), { celebrant: 'Mia', _purged: true });
  assert.equal(birthday.title(birthday.expiredSummary(b)), birthday.title(b));
});

test('registry', () => {
  assert.equal(occasionOf('birthday_invitation'), birthday);
  assert.equal(occasionOf('debut_invitation'), null);
  assert.equal(occasionOf(undefined), null);
  assert.deepEqual([...birthday.layouts], ['confetti', 'golden']);
  assert.deepEqual([...wedding.layouts], ['classic', 'garden', 'modern']);
  assert.equal(birthday.askKids, true);
  assert.equal(wedding.askKids, false);
});

test('validateRsvp kids', () => {
  const r = (o, opts) => validateRsvp({ guestName: 'A', attending: true, partySize: 2, ...o }, opts);
  assert.equal(r({ kidsCount: 3 }, { askKids: true }).rsvp.kidsCount, 3);
  for (const k of [11, -1, undefined]) assert.equal(r({ kidsCount: k }, { askKids: true }).ok, false);
  assert.equal(r({ kidsCount: 3 }).rsvp.kidsCount, 0);
  const no = r({ attending: false, partySize: 5, kidsCount: 4 }, { askKids: true }).rsvp;
  assert.equal(no.partySize, 1);
  assert.equal(no.kidsCount, 0);
});
