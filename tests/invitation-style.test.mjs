import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONT_PAIRS, validateStyle, deriveScheme, contrast, remapCover, coverIndexToKey } from '../shared/invitation-style.ts';

const COVER = { photo: 0, x: 50, y: 50, zoom: 1, tone: 'dark', strength: 0.4, fade: true };
const bad = (input, opts = { photoCount: 2 }) => { const r = validateStyle(input, opts); assert.ok('error' in r, JSON.stringify(input)); return r.error; };

test('empty and missing are valid and give {}', () => {
  assert.deepEqual(validateStyle(undefined), { style: {} });
  assert.deepEqual(validateStyle({}), { style: {} });
});

test('a full valid style passes, with index or key', () => {
  const s = { v: 1, font: 'modern', colors: { primary: '#7a1f3d', accent: '#c9a24b' }, cover: COVER };
  assert.deepEqual(validateStyle(s, { photoCount: 1 }), { style: s });
  const k = { ...s, cover: { ...COVER, photo: 'r2/a.jpg' } };
  assert.deepEqual(validateStyle(k, { photoKeys: ['r2/a.jpg'] }), { style: k });
});

test('specific errors', () => {
  assert.match(bad({ foo: 1 }), /foo/);
  assert.match(bad({ v: 2 }), /version|v/i);
  assert.match(bad({ font: 'comic' }), /font/i);
  assert.match(bad({ colors: { primary: 'red', accent: '#000000' } }), /primary/);
  assert.match(bad({ colors: { primary: '#000000', accent: '#12345' } }), /accent/);
  assert.match(bad({ colors: { primary: '#000000' } }), /accent/);
  assert.match(bad({ cover: { ...COVER, photo: 2 } }), /photo/);
  assert.match(bad({ cover: { ...COVER, photo: 0.5 } }), /photo/);
  assert.match(bad({ cover: { ...COVER, photo: -1 } }), /photo/);
  assert.match(bad({ cover: { ...COVER, photo: 'x' } }, { photoKeys: ['a'] }), /photo/);
  assert.match(bad({ cover: { ...COVER, x: 101 } }), /x/);
  assert.match(bad({ cover: { ...COVER, y: -1 } }), /y/);
  assert.match(bad({ cover: { ...COVER, zoom: 3.1 } }), /zoom/);
  assert.match(bad({ cover: { ...COVER, zoom: 0.9 } }), /zoom/);
  assert.match(bad({ cover: { ...COVER, strength: 0.81 } }), /strength/);
  assert.match(bad({ cover: { ...COVER, tone: 'red' } }), /tone/);
  assert.match(bad({ cover: { ...COVER, fade: 'yes' } }), /fade/);
  assert.match(bad({ cover: { ...COVER, extra: 1 } }), /extra/);
  assert.match(bad('x'), /style/i);
  assert.match(bad([]), /style/i);
});

test('contrast is WCAG', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
  assert.ok(contrast('#777777', '#ffffff') < 4.5);
  assert.ok(contrast('#595959', '#ffffff') >= 4.5);
});

test('deriveScheme keeps text/background >= 4.5 and headings >= 3', () => {
  for (const p of ['#000000', '#ffffff', '#ffff00', '#7a1f3d', '#f5e6e8', '#00ff00']) {
    for (const a of ['#c9a24b', '#ffffff', '#000000']) {
      const s = deriveScheme(p, a);
      assert.ok(contrast(s.text, s.background) >= 4.5, `${p} ${a}`);
      assert.ok(contrast(s.primary, s.background) >= 3, `${p} ${a}`);
      assert.equal(s.accent, a);
    }
  }
});

test('font pairs', () => {
  assert.deepEqual(Object.keys(FONT_PAIRS), ['classic', 'modern', 'romantic', 'playful', 'elegant']);
  assert.deepEqual(FONT_PAIRS.romantic.googleFamilies, ['Great+Vibes', 'Lato:wght@400;700']);
  assert.equal(FONT_PAIRS.classic.serif, 'Cormorant Garamond');
});

test('coverIndexToKey and remapCover', () => {
  const s = { v: 1, cover: { ...COVER, photo: 1 } };
  const k = coverIndexToKey(s, ['a', 'b']);
  assert.equal(k.cover.photo, 'b');
  assert.deepEqual(coverIndexToKey({}, ['a']), {});
  assert.equal(remapCover(k, ['a', 'b'], ['b', 'a']).cover.photo, 'b');
  assert.deepEqual(remapCover(k, ['a', 'b'], ['a']), { v: 1 });
  assert.equal(remapCover(s, ['a', 'b'], ['b']).cover.photo, 'b');
  assert.deepEqual(remapCover({}, [], []), {});
});
