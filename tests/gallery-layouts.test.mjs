// Gallery layouts (grid, masonry, carousel, polaroid) and the "Shared by guests" strip, rendered in one layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const outdir = fileURLToPath(new URL('../node_modules/.cache/jlc-tests/gallery-layouts', import.meta.url));
await build({
  entryPoints: ['Garden', 'Modern'].map((n) => fileURLToPath(new URL(`../src/invitations/layouts/${n}.tsx`, import.meta.url))),
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outdir, outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const Garden = (await import(pathToFileURL(`${outdir}/Garden.mjs`).href)).default;
const Modern = (await import(pathToFileURL(`${outdir}/Modern.mjs`).href)).default;

const scheme = { primary: '#8b1e3f', accent: '#c9a66b', background: '#fbf7f2', text: '#2b2b2b' };
const details = { partner1: 'Maria', partner2: 'Juan', eventDate: '2099-02-14', eventTime: '15:30', schedule: [] };
const photos = ['/photos/inv/1/0.jpg', '/photos/inv/1/1.jpg', '/photos/inv/1/2.jpg'];
const render = (events, L = Garden) => renderToStaticMarkup(createElement(L, { details, scheme, photos, style: {}, events }));

test('no setting and grid render exactly the old gallery', () => {
  const old = render(undefined);
  assert.equal(render({}), old);
  assert.equal(render({ galleryLayout: 'grid' }), old);
  assert.equal(render({ guestPhotos: [] }), old);
  assert.match(old, /<div class="gd-photos"><img src="\/photos\/inv\/1\/0.jpg"/);
});

test('masonry and polaroid use the shared gallery classes', () => {
  const m = render({ galleryLayout: 'masonry' });
  assert.match(m, /<div class="inv-gallery inv-masonry"><img/);
  assert.doesNotMatch(m, /gd-photos/);
  const p = render({ galleryLayout: 'polaroid' });
  assert.equal((p.match(/<figure class="inv-print">/g) || []).length, 3);
  assert.match(p, /alt="Maria and Juan, photo 1 of 3"/);
});

test('carousel: a labelled region with slides, prev/next and dot buttons, and a focusable track', () => {
  const c = render({ galleryLayout: 'carousel' });
  assert.match(c, /role="region" aria-roledescription="carousel"/);
  assert.match(c, /class="inv-car-track" tabindex="0"/);
  assert.equal((c.match(/aria-roledescription="slide"/g) || []).length, 3);
  assert.match(c, /aria-label="Previous photo" disabled=""/);
  assert.match(c, /aria-label="Next photo"/);
  assert.equal((c.match(/class="inv-car-dot"/g) || []).length, 3);
  assert.match(c, /aria-label="Show photo 1" aria-current="true"/);
  // past 12 photos, a counter replaces the dots
  const many = renderToStaticMarkup(createElement(Garden, { details, scheme, photos: Array.from({ length: 13 }, (_, i) => `/p/${i}.jpg`), style: {}, events: { galleryLayout: 'carousel' } }));
  assert.match(many, /1 \/ 13/);
  assert.doesNotMatch(many, /inv-car-dot/);
});

test('Modern keeps its first photo out of the gallery in every layout', () => {
  assert.equal((render({ galleryLayout: 'carousel' }, Modern).match(/aria-roledescription="slide"/g) || []).length, 2);
});

test('approved guest photos show in a "Shared by guests" strip in the same layout, with the upload form after it', () => {
  const g = render({ galleryLayout: 'masonry', guestPhotos: ['/photos/inv/1/guest-1-abcdef.jpg'], guestShare: createElement('form', { id: 'share' }) });
  assert.match(g, /<h3 class="gd-small">Shared by guests<\/h3><div class="inv-gallery inv-masonry"><img src="\/photos\/inv\/1\/guest-1-abcdef.jpg"[^>]*alt="Shared by guests, photo 1 of 1"/);
  assert.match(g, /<\/div><form id="share"><\/form>/);
  // the upload form alone, before any photo is approved
  assert.match(render({ guestShare: createElement('form', { id: 'share' }) }), /aria-label="Photos from guests"><div class="inv-ev-body"><form id="share">/);
});
