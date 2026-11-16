// Renders the Portrait layout for each occasion, with and without a cover photo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// Written inside node_modules so the external react import resolves to the project's copy.
const outfile = fileURLToPath(new URL('../node_modules/.cache/jlc-tests/portrait.mjs', import.meta.url));
await build({ entryPoints: [fileURLToPath(new URL('../src/invitations/layouts/Portrait.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outfile, logLevel: 'warning' });
const { default: Portrait } = await import(pathToFileURL(outfile).href);

const scheme = { primary: '#8b1e3f', accent: '#c9a66b', background: '#fbf7f2', text: '#2b2b2b' };
const v = (name, mapUrl = '') => ({ name, address: name + ' St', mapUrl });
const render = (details, photos = [], style = {}) => renderToStaticMarkup(createElement(Portrait, { details, scheme, photos, style, rsvpSlot: createElement('form', { id: 'rsvp' }) }));
const COVER = { photo: 1, x: 50, y: 40, zoom: 1, tone: 'dark', strength: 0.4, fade: false };

test('wedding: card text, both venues with map links, schedule, message, RSVP', () => {
  const html = render({
    partner1: 'Maria', partner2: 'Juan', eventDate: '2099-02-14', eventTime: '15:30', message: 'See you there',
    ceremony: v('San Agustin Church', 'https://maps.example/a'), reception: v('Manila Hotel', 'https://maps.example/b'),
    schedule: [{ time: '17:00', label: 'Dinner' }],
  });
  for (const s of ['Together with their families', '<h1 class="pt-headline">Maria &amp; Juan</h1>', 'invite you to celebrate their wedding',
    'Saturday, February 14, 2099 · 3:30 PM', 'San Agustin Church', 'Manila Hotel', 'https://maps.example/a', 'https://maps.example/b',
    'Dinner', 'See you there', 'id="rsvp"', 'class="cd ']) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /inv-cover/);
});

test('debut and birthday: their own card text and single venue', () => {
  const debutHtml = render({ debutante: 'Sofia', eventDate: '2099-05-01', eventTime: '', venue: v('Grand Ballroom'), schedule: [] });
  for (const s of ['Please join us to celebrate', 'Sofia', 'her 18th birthday', 'Grand Ballroom']) assert.ok(debutHtml.includes(s), s);
  const bdHtml = render({ celebrant: 'Mia', age: 7, eventDate: '2099-03-14', eventTime: '10:00', venue: v('Party Room'), schedule: [] });
  for (const s of ["You&#x27;re invited", 'Mia', '7th birthday', 'Party Room']) assert.ok(bdHtml.includes(s), s);
});

test('cover: hero gets the cover photo and overlay, the gallery leaves it out', () => {
  const html = render({ celebrant: 'Mia', eventDate: '2099-03-14', eventTime: '', venue: v('Party Room'), schedule: [] }, ['a.jpg', 'b.jpg', 'c.jpg'], { font: 'modern', cover: COVER });
  assert.match(html, /class="pt-hero inv-cover"/);
  assert.match(html, /--cover-overlay:rgba\(0,0,0,0.4\)/);
  assert.match(html, /--serif:&#x27;DM Serif Display&#x27;/);
  assert.equal(html.match(/src="b\.jpg"/g).length, 1); // only the cover layer
  assert.match(html, /alt="Mia&#x27;s Birthday, photo 1 of 2" src="a\.jpg"|src="a\.jpg"[^>]*alt="Mia&#x27;s Birthday, photo 1 of 2"/);
  assert.ok(html.includes('c.jpg'));
});
