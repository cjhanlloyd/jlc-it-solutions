import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchTo, reviewRows } from '../src/invitations/studio/review.ts';
import { followCover } from '../src/invitations/studio/cover.ts';
import { serializeDraft, parseDraft } from '../src/invitations/studio/draft.ts';

const pkg = (key, kind = 'template', priceCentavos = 99900) => ({ key, name: key, priceCentavos, inclusions: [], kind });
const scheme = (name) => ({ name, primary: '#111111', accent: '#222222', background: '#ffffff', text: '#000000' });
const to = { slug: 'garden', packages: [pkg('basic'), pkg('premium'), pkg('custom', 'custom')], colorSchemes: [scheme('Sage'), scheme('Blush')] };
const COVER = { photo: 1, x: 20, y: 70, zoom: 1.5, tone: 'dark', strength: 0.5, fade: true };

test('switching keeps the package key when the new design has it, else uses its first template package', () => {
  assert.equal(switchTo(to, { packageKey: 'premium', scheme: 'Sage', style: {} }).url, '/designs/garden/customise?package=premium');
  assert.equal(switchTo(to, { packageKey: 'custom', scheme: 'Sage', style: {} }).url, '/designs/garden/customise?package=custom');
  assert.equal(switchTo(to, { packageKey: 'deluxe', scheme: 'Sage', style: {} }).url, '/designs/garden/customise?package=basic');
  assert.equal(switchTo(to, { packageKey: undefined, scheme: 'Sage', style: {} }).url, '/designs/garden/customise?package=basic');
  assert.equal(switchTo({ ...to, slug: 'a b' }, { packageKey: 'basic', scheme: '', style: {} }).url, '/designs/a%20b/customise?package=basic');
});

test('switching keeps a same-named scheme, keeps Custom with its colours, else uses the first scheme', () => {
  assert.equal(switchTo(to, { packageKey: 'basic', scheme: 'Blush', style: {} }).scheme, 'Blush');
  assert.equal(switchTo(to, { packageKey: 'basic', scheme: 'Navy', style: {} }).scheme, 'Sage');
  const colors = { primary: '#7a1f3d', accent: '#d4af37' };
  assert.equal(switchTo(to, { packageKey: 'basic', scheme: 'Custom', style: { v: 1, colors } }).scheme, 'Custom');
  assert.equal(switchTo(to, { packageKey: 'basic', scheme: 'Custom', style: {} }).scheme, 'Sage');
});

test('adding photos at the end never moves the cover, so a photo add only needs to update photos', () => {
  const style = { v: 1, font: 'modern', cover: COVER };
  assert.deepEqual(followCover(style, ['a', 'b'], ['a', 'b', 'c', 'd']), style);
});

test('the photo notice flag survives autosaves until photos are added', () => {
  const base = { slug: 'a', draft: {}, scheme: 'Sage', style: {}, email: '' };
  assert.equal(parseDraft(serializeDraft({ ...base, photos: [], hadPhotos: true }), 'a').hadPhotos, true);
  assert.equal(parseDraft(serializeDraft({ ...base, photos: [] }), 'a').hadPhotos, false);
  assert.equal(parseDraft(serializeDraft({ ...base, photos: ['p'] }), 'a').hadPhotos, true);
});

const input = {
  design: 'Garden', pkg: { name: 'Premium', kind: 'template' }, price: '₱1,499', scheme: 'Sage', style: {}, photos: 0,
  title: 'Anna & Ben', date: '2027-03-14', venue: 'Manila Cathedral', notes: '',
};
const row = (rows, label) => rows.find((r) => r.label === label);

test('the review summary lists every choice with the tab that edits it', () => {
  const rows = reviewRows(input);
  assert.deepEqual(rows.map((r) => [r.label, r.tab]), [
    ['Design', 'design'], ['Package', 'design'], ['Font', 'design'], ['Colours', 'design'], ['Cover', 'photos'], ['Photos', 'photos'], ['Details', 'details'],
  ]);
  assert.equal(row(rows, 'Design').value, 'Garden');
  assert.equal(row(rows, 'Package').value, 'Premium · ₱1,499');
  assert.equal(row(rows, 'Font').value, 'Design default');
  assert.equal(row(rows, 'Colours').value, 'Sage');
  assert.equal(row(rows, 'Cover').value, 'Off');
  assert.equal(row(rows, 'Photos').value, 'None');
  assert.equal(row(rows, 'Details').value, 'Anna & Ben · Sunday, March 14, 2027 · Manila Cathedral');
});

test('the review summary describes custom colours, the cover settings and designer notes', () => {
  const rows = reviewRows({
    ...input, pkg: { name: 'Custom design', kind: 'custom' }, scheme: 'Custom', photos: 3, venue: '', notes: 'Gold foil please',
    style: { v: 1, font: 'elegant', colors: { primary: '#7a1f3d', accent: '#d4af37' }, cover: { ...COVER, photo: 0 } },
  });
  assert.equal(row(rows, 'Font').value, 'Elegant');
  assert.equal(row(rows, 'Colours').value, 'Custom (#7a1f3d, #d4af37)');
  assert.equal(row(rows, 'Cover').value, 'On · photo 1 · zoom 150% · dark overlay 50% · fade');
  assert.equal(row(rows, 'Photos').value, '3');
  assert.equal(row(rows, 'Details').value, 'Anna & Ben · Sunday, March 14, 2027');
  assert.deepEqual(row(rows, 'Designer notes'), { label: 'Designer notes', value: 'Gold foil please', tab: 'details' });
});
