import test from 'node:test';
import assert from 'node:assert/strict';
import { toBirthdayDraft, checkBirthdayDraft, previewBirthday } from '../src/invitations/forms/birthday-draft.ts';

const filled = (o = {}) => ({ ...toBirthdayDraft(), celebrant: 'Mia', eventDate: '2027-03-14', venue: { name: 'Party Room', address: '', mapUrl: '' }, ...o });

test('empty draft fails with celebrant name required', () => {
  const r = checkBirthdayDraft(toBirthdayDraft());
  assert.equal(r.ok, false);
  assert.match(r.error, /Celebrant name is required/);
});

test('age string becomes a number, blank is omitted, junk fails', () => {
  const ok = checkBirthdayDraft(filled({ age: '7' }));
  assert.equal(ok.ok, true);
  assert.equal(ok.details.age, 7);
  const none = checkBirthdayDraft(filled({ age: '' }));
  assert.equal(none.ok, true);
  assert.equal('age' in none.details, false);
  const bad = checkBirthdayDraft(filled({ age: 'abc' }));
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'Age must be a whole number from 1 to 120');
});

test('preview falls back to the sample celebrant and venue while blank', () => {
  const sample = toBirthdayDraft({ celebrant: 'Sample', age: 5, eventDate: '2027-01-01', venue: { name: 'Sample Hall', address: '', mapUrl: '' } });
  const p = previewBirthday(toBirthdayDraft(), sample);
  assert.equal(p.celebrant, 'Sample');
  assert.equal(p.venue.name, 'Sample Hall');
  assert.equal(p.eventDate, '2027-01-01');
  assert.equal(p.age, undefined);
  assert.equal(previewBirthday(filled({ age: '9' }), sample).age, 9);
});
