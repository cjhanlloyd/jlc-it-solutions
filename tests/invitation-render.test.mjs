import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrast } from '../shared/invitation-style.ts';
import { fontHref, coverText, coverOverlay, resolveCoverIndex, coverFor, effectiveScheme, MIN_OVERLAY } from '../src/invitations/style-render.ts';

const COVER = { x: 30, y: 60, zoom: 1.5, tone: 'dark', strength: 0.4, fade: true };

test('fontHref builds one css2 link for the chosen pair', () => {
  assert.equal(fontHref({ font: 'romantic' }), 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lato:wght@400;700&display=swap');
  assert.equal(fontHref({ font: 'classic' }), 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Jost:wght@400;600&display=swap');
  assert.equal(fontHref({}), null);
  assert.equal(fontHref(undefined), null);
  assert.equal(fontHref({ font: 'toString' }), null);
});

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const TONE_RGB = { dark: () => [0, 0, 0], light: () => [255, 255, 255], scheme: (p) => rgb(p) };

test('cover text reads at 4.5:1 over the overlay composited on mid-grey, for every tone, primary and strength', () => {
  for (const tone of ['dark', 'light', 'scheme']) {
    for (const primary of ['#fbe7ec', '#f5e6c8', '#ffffff', '#b76e79', '#3b2a2e', '#1a1a5a', '#000000']) {
      for (const strength of [0, 0.3, 0.8]) {
        const s = Math.max(strength, MIN_OVERLAY);
        const bg = hex(TONE_RGB[tone](primary).map((v) => v * s + 128 * (1 - s)));
        const { color } = coverText(tone, primary);
        assert.ok(contrast(color, bg) >= 4.5, `${tone} ${primary} ${strength}: ${color} on ${bg} = ${contrast(color, bg).toFixed(2)}`);
      }
    }
  }
});

test('coverText: dark and light tones are fixed; scheme follows the primary; halo is the opposite colour', () => {
  assert.equal(coverText('dark', '#ffffff').color, '#ffffff');
  assert.equal(coverText('light', '#000000').color, '#111111');
  assert.equal(coverText('scheme', '#1a1a5a').color, '#ffffff');
  assert.equal(coverText('scheme', '#fbe7ec').color, '#111111');
  assert.match(coverText('dark', '#000000').textShadow, /rgba\(0,0,0/);
  assert.match(coverText('light', '#000000').textShadow, /rgba\(255,255,255/);
});

test('coverOverlay per tone, with a 30% floor', () => {
  assert.equal(MIN_OVERLAY, 0.3);
  assert.equal(coverOverlay('dark', 0.4, '#123456'), 'rgba(0,0,0,0.4)');
  assert.equal(coverOverlay('dark', 0, '#123456'), 'rgba(0,0,0,0.3)');
  assert.equal(coverOverlay('light', 0.1, '#123456'), 'rgba(255,255,255,0.3)');
  assert.equal(coverOverlay('scheme', 0.5, '#8b1e3f'), 'rgba(139,30,63,0.5)');
  assert.equal(coverOverlay('scheme', 0.1, '#ffffff'), 'rgba(255,255,255,0.3)');
});

test('invitation layouts size against their container, not the viewport', () => {
  const css = readFileSync(new URL('../src/invitations/invitations.css', import.meta.url), 'utf8');
  assert.match(css, /\.inv-root \{ container-type: inline-size; \}/);
  assert.doesNotMatch(css, /\d(d|s|l)?vw\b/);
  assert.doesNotMatch(css, /@media[^{]*width/);
});

test('effectiveScheme derives Custom colours, keeps others, and accepts a null style', () => {
  const kit = { name: 'Sage', primary: '#5f7a61', accent: '#c9a66b', background: '#f7f9f4', text: '#2b3a2d' };
  assert.equal(effectiveScheme(kit, { colors: { primary: '#123456', accent: '#abcdef' } }), kit);
  assert.equal(effectiveScheme(kit, null), kit);
  const c = effectiveScheme({ ...kit, name: 'Custom' }, { colors: { primary: '#123456', accent: '#abcdef' } });
  assert.equal(c.accent, '#abcdef');
  assert.equal(c.text, '#1a1a1a');
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

test('an empty or null style produces no cover', () => {
  assert.deepEqual(coverFor({}, ['a']), { cover: null, gallery: ['a'] });
  assert.deepEqual(coverFor(null, ['a']), { cover: null, gallery: ['a'] });
  assert.equal(fontHref(null), null);
});
