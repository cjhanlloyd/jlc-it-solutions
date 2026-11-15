import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragFocus, nudgeFocus, followCover, averageRgb, coverContrast, strengthToRead, READABLE } from '../src/invitations/studio/cover.ts';
import { serializeDraft, parseDraft } from '../src/invitations/studio/draft.ts';

const COVER = { photo: 1, x: 50, y: 50, zoom: 1, tone: 'dark', strength: 0.45, fade: false };

test('dragging moves the photo with the pointer, corrected for the preview scale', () => {
  // 100 screen px at scale 0.5 is 200 render px, a fifth of a 1000 px wide hero
  assert.deepEqual(dragFocus({ x: 50, y: 50 }, 100, 0, 0.5, 1000, 400), { x: 30, y: 50 });
  assert.deepEqual(dragFocus({ x: 50, y: 50 }, 0, -40, 1, 1000, 400), { x: 50, y: 60 });
});

test('dragging clamps the focal point to 0–100', () => {
  assert.deepEqual(dragFocus({ x: 10, y: 90 }, 5000, -5000, 1, 300, 300), { x: 0, y: 100 });
  assert.deepEqual(dragFocus({ x: 10, y: 90 }, -5000, 5000, 0.4, 300, 300), { x: 100, y: 0 });
});

test('arrow keys nudge the photo by 2% in the arrow direction and clamp', () => {
  assert.deepEqual(nudgeFocus({ x: 50, y: 50 }, 'ArrowRight'), { x: 48, y: 50 });
  assert.deepEqual(nudgeFocus({ x: 50, y: 50 }, 'ArrowLeft'), { x: 52, y: 50 });
  assert.deepEqual(nudgeFocus({ x: 50, y: 50 }, 'ArrowDown'), { x: 50, y: 48 });
  assert.deepEqual(nudgeFocus({ x: 50, y: 99 }, 'ArrowUp'), { x: 50, y: 100 });
  assert.equal(nudgeFocus({ x: 50, y: 50 }, 'Enter'), null);
});

test('the cover follows its photo when photos move, and is dropped when it is removed', () => {
  const style = { v: 1, font: 'modern', cover: COVER };
  assert.equal(followCover(style, ['a', 'b', 'c'], ['b', 'a', 'c']).cover.photo, 0);
  assert.equal(followCover(style, ['a', 'b', 'c'], ['a', 'c', 'b']).cover.photo, 2);
  assert.equal(followCover(style, ['a', 'b', 'c'], ['a', 'b', 'c', 'd']).cover.photo, 1);
  assert.deepEqual(followCover(style, ['a', 'b', 'c'], ['a', 'c']), { v: 1, font: 'modern' });
  assert.deepEqual(followCover({ font: 'modern' }, ['a'], []), { font: 'modern' });
});

test('readability: average colour, overlay at its effective strength, and the one-click strength', () => {
  assert.deepEqual(averageRgb([255, 255, 255, 255, 0, 0, 0, 255]), [127.5, 127.5, 127.5]);
  const white = [255, 255, 255];
  // a white photo under a 45% dark overlay is too light for white text
  assert.ok(coverContrast(white, COVER, '#7a1f3d') < READABLE);
  const s = strengthToRead(white, COVER, '#7a1f3d');
  assert.ok(s > 0.45 && s <= 0.8);
  assert.ok(coverContrast(white, { ...COVER, strength: s }, '#7a1f3d') >= READABLE);
  // the overlay never counts below 30%
  assert.equal(coverContrast(white, { ...COVER, strength: 0 }, '#000000'), coverContrast(white, { ...COVER, strength: 0.3 }, '#000000'));
  // a dark photo is already readable under a dark overlay
  assert.ok(coverContrast([10, 10, 10], COVER, '#7a1f3d') >= READABLE);
  assert.ok(coverContrast(white, { ...COVER, tone: 'light' }, '#7a1f3d') >= READABLE);
});

test('the draft serializer keeps no photos, only whether there were some', () => {
  const raw = serializeDraft({ slug: 'a', draft: { partner1: 'X' }, scheme: 'Custom', style: { v: 1, colors: { primary: '#7a1f3d', accent: '#d4af37' }, cover: COVER }, email: 'e@x.com', name: 'N', phone: '', photos: ['data:image/jpeg;base64,AAAA'] });
  assert.ok(!raw.includes('base64'));
  const saved = parseDraft(raw, 'a');
  assert.equal(saved.hadPhotos, true);
  assert.equal(saved.scheme, 'Custom');
  assert.deepEqual(saved.draft, { partner1: 'X' });
  // photos are not restored, so neither is the cover
  assert.deepEqual(saved.style, { v: 1, colors: { primary: '#7a1f3d', accent: '#d4af37' } });
});

test('a draft for another design, broken JSON or an invalid style restores safely', () => {
  const raw = serializeDraft({ slug: 'a', draft: {}, scheme: 'Blush', style: { font: 'comic' }, email: '', photos: [] });
  assert.equal(parseDraft(raw, 'b'), null);
  assert.equal(parseDraft('{oops', 'a'), null);
  assert.equal(parseDraft(null, 'a'), null);
  assert.deepEqual(parseDraft(raw, 'a').style, {});
  assert.equal(parseDraft(raw, 'a').hadPhotos, false);
  assert.deepEqual(parseDraft(JSON.stringify({ slug: 'a', draft: {} }), 'a').style, {});
});
