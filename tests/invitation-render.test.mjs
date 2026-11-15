import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontHref, coverText, coverOverlay, resolveCoverIndex, coverFor } from '../src/invitations/style-render.ts';

const COVER = { x: 30, y: 60, zoom: 1.5, tone: 'dark', strength: 0.4, fade: true };

test('fontHref builds one css2 link for the chosen pair', () => {
  assert.equal(fontHref({ font: 'romantic' }), 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lato:wght@400;700&display=swap');
  assert.equal(fontHref({ font: 'classic' }), 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Jost:wght@400;600&display=swap');
  assert.equal(fontHref({}), null);
  assert.equal(fontHref(undefined), null);
  assert.equal(fontHref({ font: 'toString' }), null);
});

test('coverText: light text over dark and scheme overlays, dark text over light', () => {
  assert.equal(coverText('dark').color, '#fff');
  assert.equal(coverText('scheme').color, '#fff');
  assert.ok(coverText('dark').textShadow);
  assert.deepEqual(coverText('light'), { color: '#111', textShadow: 'none' });
});

test('coverOverlay per tone', () => {
  assert.equal(coverOverlay('dark', 0.4), 'rgba(0,0,0,0.4)');
  assert.equal(coverOverlay('light', 0.25), 'rgba(255,255,255,0.25)');
  assert.equal(coverOverlay('scheme', 0.5), 'color-mix(in srgb, var(--p) 50%, transparent)');
});

test('resolveCoverIndex turns a stored key into an index, or drops the cover', () => {
  const s = { v: 1, font: 'modern', cover: { ...COVER, photo: 'k2' } };
  assert.deepEqual(resolveCoverIndex(s, ['k1', 'k2']), { v: 1, font: 'modern', cover: { ...COVER, photo: 1 } });
  assert.deepEqual(resolveCoverIndex(s, ['k1', 'data:image/jpeg;base64,x']), { v: 1, font: 'modern' });
  const n = { cover: { ...COVER, photo: 0 } };
  assert.equal(resolveCoverIndex(n, ['k1']), n);
  assert.deepEqual(resolveCoverIndex({}, ['k1']), {});
});

test('coverFor picks the cover url and leaves it out of the gallery', () => {
  const photos = ['a', 'b', 'c'];
  assert.deepEqual(coverFor({ cover: { ...COVER, photo: 1 } }, photos), { cover: { ...COVER, url: 'b' }, gallery: ['a', 'c'] });
  assert.deepEqual(coverFor({}, photos), { cover: null, gallery: photos });
  assert.deepEqual(coverFor(undefined, photos), { cover: null, gallery: photos });
  assert.deepEqual(coverFor({ cover: { ...COVER, photo: 5 } }, photos), { cover: null, gallery: photos });
  assert.deepEqual(coverFor({ cover: { ...COVER, photo: 'k1' } }, photos), { cover: null, gallery: photos });
});
