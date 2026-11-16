import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthday } from '../shared/occasions/birthday.ts';
import { debut } from '../shared/occasions/debut.ts';
import { wedding } from '../shared/occasions/wedding.ts';
import { OCCASIONS, occasionForDetails } from '../shared/occasions/index.ts';

const v = (name, extra = {}) => ({ name, address: '', mapUrl: '', ...extra });

test('wedding card: names, date with time, both venues', () => {
  assert.deepEqual(wedding.card({
    partner1: 'Maria', partner2: 'Juan', eventDate: '2027-02-14', eventTime: '15:30',
    ceremony: v('San Agustin Church'), reception: v('Manila Hotel'), schedule: [],
  }), {
    kicker: 'Together with their families', headline: 'Maria & Juan', subline: 'invite you to celebrate their wedding',
    dateLine: 'Sunday, February 14, 2027 · 3:30 PM', venueLine: 'San Agustin Church · Manila Hotel',
  });
});

test('wedding card: missing optional and partial fields fall back to empty strings', () => {
  const c = wedding.card({ partner1: 'Maria', partner2: '', eventDate: '2027-02-14', eventTime: '', ceremony: v('Chapel'), schedule: [] });
  assert.equal(c.headline, 'Maria');
  assert.equal(c.dateLine, 'Sunday, February 14, 2027');
  assert.equal(c.venueLine, 'Chapel');
  const e = wedding.card({});
  assert.deepEqual(e, { kicker: 'Together with their families', headline: '', subline: 'invite you to celebrate their wedding', dateLine: '', venueLine: '' });
});

test('debut card: default kicker, headline override, missing fields', () => {
  assert.deepEqual(debut.card({ debutante: 'Sofia', eventDate: '2027-05-01', eventTime: '18:00', venue: v('Grand Ballroom'), schedule: [] }), {
    kicker: 'Please join us to celebrate', headline: 'Sofia', subline: 'her 18th birthday',
    dateLine: 'Saturday, May 1, 2027 · 6:00 PM', venueLine: 'Grand Ballroom',
  });
  assert.equal(debut.card({ debutante: 'Sofia', headline: 'An evening for' }).kicker, 'An evening for');
  const e = debut.card({});
  assert.deepEqual([e.headline, e.dateLine, e.venueLine], ['', '', '']);
});

test('birthday card: ordinal age, no age, headline override, missing fields', () => {
  assert.deepEqual(birthday.card({ celebrant: 'Mia', age: 7, eventDate: '2027-03-14', eventTime: '10:00', venue: v('Party Room'), schedule: [] }), {
    kicker: "You're invited", headline: 'Mia', subline: '7th birthday', dateLine: 'Sunday, March 14, 2027 · 10:00 AM', venueLine: 'Party Room',
  });
  assert.equal(birthday.card({ celebrant: 'Lola', age: 81 }).subline, '81st birthday');
  assert.equal(birthday.card({ celebrant: 'Roberto' }).subline, 'birthday celebration');
  assert.equal(birthday.card({ celebrant: 'Mia', headline: 'Come party with' }).kicker, 'Come party with');
  const e = birthday.card({});
  assert.deepEqual([e.headline, e.dateLine, e.venueLine], ['', '', '']);
});

test('every occasion has a card() returning five strings, and offers portrait', () => {
  for (const o of Object.values(OCCASIONS)) {
    const c = o.card({});
    assert.deepEqual(Object.keys(c).sort(), ['dateLine', 'headline', 'kicker', 'subline', 'venueLine']);
    for (const s of Object.values(c)) assert.equal(typeof s, 'string');
    assert.ok(o.layouts.includes('portrait'), o.productType);
  }
});

test('occasionForDetails tells occasions apart by their name field', () => {
  assert.equal(occasionForDetails({ partner1: 'A', partner2: 'B' }), wedding);
  assert.equal(occasionForDetails({ debutante: '' }), debut);
  assert.equal(occasionForDetails({ celebrant: 'Mia' }), birthday);
  assert.equal(occasionForDetails({ celebrant: 'Mia', _purged: true }), birthday);
  assert.equal(occasionForDetails({}), wedding);
});
