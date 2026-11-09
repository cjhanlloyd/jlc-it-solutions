// Shared invitation field rules, used by both the Pages Functions and the React frontend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDetails, validateRsvp, lockedFieldsChanged, makeSlug, LIMITS, LAYOUT_KEYS } from '../shared/invitation-fields.ts';

const base = () => ({
  partner1: '  María ', partner2: 'Juan', eventDate: '2027-06-12', eventTime: '15:00',
  ceremony: { name: ' St. Joseph Church ', address: '1 Main St', mapUrl: 'https://maps.google.com/?q=x' },
  schedule: [{ time: '15:00', label: ' Ceremony ' }],
});

test('valid details pass and are trimmed', () => {
  const r = validateDetails(base());
  assert.equal(r.ok, true);
  assert.equal(r.details.partner1, 'María');
  assert.equal(r.details.ceremony.name, 'St. Joseph Church');
  assert.equal(r.details.schedule[0].label, 'Ceremony');
});

test('unknown keys are dropped', () => {
  const r = validateDetails({ ...base(), evil: 1 });
  assert.equal(r.ok, true);
  assert.equal('evil' in r.details, false);
});

test('missing partner2 fails', () => {
  const d = base(); delete d.partner2;
  assert.equal(validateDetails(d).ok, false);
});

test('61-character name fails, 60 passes', () => {
  assert.equal(validateDetails({ ...base(), partner1: 'a'.repeat(LIMITS.name + 1) }).ok, false);
  assert.equal(validateDetails({ ...base(), partner1: 'a'.repeat(LIMITS.name) }).ok, true);
});

test('non-https mapUrl fails, empty passes', () => {
  const d = base(); d.ceremony.mapUrl = 'javascript:alert(1)';
  assert.equal(validateDetails(d).ok, false);
  d.ceremony.mapUrl = '';
  assert.equal(validateDetails(d).ok, true);
});

test('9 schedule items fail', () => {
  const schedule = Array.from({ length: 9 }, () => ({ time: '10:00', label: 'x' }));
  assert.equal(validateDetails({ ...base(), schedule }).ok, false);
});

test('bad date fails', () => {
  assert.equal(validateDetails({ ...base(), eventDate: '2027-13-40' }).ok, false);
});

test('<script> in message passes unchanged', () => {
  const r = validateDetails({ ...base(), message: '<script>x</script>' });
  assert.equal(r.ok, true);
  assert.equal(r.details.message, '<script>x</script>');
});

test('non-object input fails', () => {
  assert.equal(validateDetails(null).ok, false);
  assert.equal(validateDetails('x').ok, false);
});

test('validateRsvp accepts valid, rejects bad party size and missing name', () => {
  const ok = validateRsvp({ guestName: ' Ana ', attending: true, partySize: 2, message: 'hi' });
  assert.deepEqual(ok, { ok: true, rsvp: { guestName: 'Ana', attending: true, partySize: 2, message: 'hi' } });
  assert.equal(validateRsvp({ guestName: 'Ana', attending: true, partySize: 0 }).ok, false);
  assert.equal(validateRsvp({ guestName: 'Ana', attending: true, partySize: 11 }).ok, false);
  assert.equal(validateRsvp({ attending: true, partySize: 1 }).ok, false);
  assert.equal(validateRsvp({ guestName: 'Ana', attending: 'yes', partySize: 1 }).ok, false);
});

test('lockedFieldsChanged: partner rename true, date change false', () => {
  const a = validateDetails(base()).details;
  assert.equal(lockedFieldsChanged(a, { ...a, partner2: 'Pedro' }), true);
  assert.equal(lockedFieldsChanged(a, { ...a, eventDate: '2028-01-01' }), false);
});

test('makeSlug folds accents and suffixes', () => {
  assert.equal(makeSlug('María', 'Juan', 'k3x9'), 'maria-and-juan-k3x9');
  assert.ok(makeSlug('a'.repeat(100), 'b', 'z').length <= 62);
});

test('LAYOUT_KEYS', () => assert.deepEqual([...LAYOUT_KEYS], ['classic', 'garden', 'modern']));
