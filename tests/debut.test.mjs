import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debut } from '../shared/occasions/debut.ts';
import { occasionOf } from '../shared/occasions/index.ts';
import { toDebutDraft, checkDebutDraft, previewDebut } from '../src/invitations/forms/debut-draft.ts';
import { SAMPLES } from '../src/components/admin/design-samples.ts';

const d = (o = {}) => ({ debutante: ' Ana Reyes ', eventDate: '2027-08-21', venue: { name: 'Grand Ballroom' }, ...o });

test('debut valid minimal, registered, no kids question', () => {
  const r = debut.validateDetails(d());
  assert.equal(r.ok, true);
  assert.equal(r.details.debutante, 'Ana Reyes');
  assert.equal('roses' in r.details, false);
  assert.equal(occasionOf('debut_invitation'), debut);
  assert.equal(debut.askKids, false);
});

test('debut tradition lists are trimmed, blanks dropped, capped at 18', () => {
  const r = debut.validateDetails(d({ roses: [' Papa ', '', 'Tito Ben'], candles: [] }));
  assert.deepEqual(r.details.roses, ['Papa', 'Tito Ben']);
  assert.equal('candles' in r.details, false);
  const cases = [d({ roses: Array(19).fill('x') }), d({ candles: ['x'.repeat(61)] }), d({ treasures: 'Papa' }), d({ roses: [5] }), d({ escort: 'x'.repeat(61) })];
  cases.forEach((c, n) => assert.equal(debut.validateDetails(c).ok, false, `case ${n}`));
});

test('debut title, slug, lock, expired summary', () => {
  const det = debut.validateDetails(d()).details;
  assert.equal(debut.title(det), "Ana Reyes's Debut");
  assert.equal(debut.slugBase(det), 'Ana Reyes debut');
  assert.equal(debut.lockedFieldsChanged(det, { ...det, debutante: 'Anna' }), true);
  assert.equal(debut.lockedFieldsChanged(det, { ...det, roses: ['Papa'] }), false);
  assert.deepEqual(debut.expiredSummary(det), { debutante: 'Ana Reyes', _purged: true });
});

test('debut admin sample passes the rules', () => {
  assert.equal(debut.validateDetails(SAMPLES.debut_invitation).ok, true);
});

test('debut draft: one name per line, round trip, preview fallback', () => {
  const draft = { ...toDebutDraft(), debutante: 'Ana', eventDate: '2027-08-21', venue: { name: 'Hall', address: '', mapUrl: '' }, roses: 'Papa\n\n  Tito Ben \n' };
  const r = checkDebutDraft(draft);
  assert.equal(r.ok, true);
  assert.deepEqual(r.details.roses, ['Papa', 'Tito Ben']);
  assert.equal(toDebutDraft(r.details).roses, 'Papa\nTito Ben');
  const sample = toDebutDraft({ debutante: 'Sample', eventDate: '2027-01-01', venue: { name: 'S Hall', address: '', mapUrl: '' }, candles: ['Lola'] });
  const p = previewDebut(toDebutDraft(), sample);
  assert.equal(p.debutante, 'Sample');
  assert.equal(p.venue.name, 'S Hall');
  assert.deepEqual(p.roses, []);
});

test('docs/designs/debut.md sample matches the exported sample', async () => {
  const { readFileSync } = await import('node:fs');
  const blocks = [...readFileSync(new URL('../docs/designs/debut.md', import.meta.url), 'utf8').matchAll(/```json\r?\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(blocks, [SAMPLES.debut_invitation]);
});
