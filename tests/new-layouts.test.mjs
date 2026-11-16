// Renders the release B layouts (Editorial, Minimal, Starlight, Pastel), with and without a cover photo and a font.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const NAMES = ['Editorial', 'Minimal', 'Starlight', 'Pastel'];
// Written inside node_modules so the external react import resolves to the project's copy.
const outdir = fileURLToPath(new URL('../node_modules/.cache/jlc-tests/new-layouts', import.meta.url));
await build({
  entryPoints: NAMES.map((n) => fileURLToPath(new URL(`../src/invitations/layouts/${n}.tsx`, import.meta.url))),
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outdir, outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const L = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, (await import(pathToFileURL(`${outdir}/${n}.mjs`).href)).default])));

const scheme = { primary: '#8b1e3f', accent: '#c9a66b', background: '#fbf7f2', text: '#2b2b2b' };
const v = (name, mapUrl = '') => ({ name, address: name + ' St', mapUrl });
const render = (name, details, photos = [], style = {}) =>
  renderToStaticMarkup(createElement(L[name], { details, scheme, photos, style, rsvpSlot: createElement('form', { id: 'rsvp' }) }));
const COVER = { photo: 1, x: 50, y: 40, zoom: 1, tone: 'dark', strength: 0.4, fade: false };

const WEDDING = {
  partner1: 'Maria', partner2: 'Juan', eventDate: '2099-02-14', eventTime: '15:30', message: 'See you there',
  ceremony: v('San Agustin Church', 'https://maps.example/a'), reception: v('Manila Hotel', 'https://maps.example/b'),
  schedule: [{ time: '17:00', label: 'Dinner' }], dressCode: 'Formal', giftsNote: 'Your presence', rsvpDeadline: '2099-01-10',
};
const DEBUT = {
  debutante: 'Sofia', eventDate: '2099-05-01', eventTime: '18:00', venue: v('Grand Ballroom', 'https://maps.example/c'),
  schedule: [{ time: '19:00', label: 'Cotillion' }], escort: 'Marco', roses: ['Leo', 'Ben'], candles: ['Ana'], theme: 'Starry night',
};
const BIRTHDAY = {
  celebrant: 'Mia', age: 7, eventDate: '2099-03-14', eventTime: '10:00', venue: v('Party Room', 'https://maps.example/d'),
  schedule: [{ time: '11:00', label: 'Games' }], theme: 'Unicorns', hostedBy: 'The Cruz family',
};
const CASES = [
  ['Editorial', 'ed', WEDDING, ['Maria', 'Juan', 'San Agustin Church', 'Manila Hotel', 'https://maps.example/a', 'https://maps.example/b', 'Ceremony', 'Reception', 'Dinner', 'See you there', 'Formal', 'Your presence', 'January 10, 2099', 'February 14, 2099', '3:30 PM']],
  ['Minimal', 'mn', WEDDING, ['Maria', 'Juan', 'San Agustin Church', 'Manila Hotel', 'https://maps.example/a', 'https://maps.example/b', 'Ceremony', 'Reception', 'Dinner', 'See you there', 'Formal', 'Your presence', 'January 10, 2099', 'February 14, 2099', '3:30 PM']],
  ['Starlight', 'st', DEBUT, ['Sofia', '18', 'Grand Ballroom', 'https://maps.example/c', 'Cotillion', 'Marco', '18 Roses', 'Leo', 'Ben', '18 Candles', 'Ana', 'Starry night', 'May 1, 2099', '6:00 PM']],
  ['Pastel', 'ps', BIRTHDAY, ['Mia', '7<sup>th</sup>', 'Party Room', 'https://maps.example/d', 'Games', 'Unicorns', 'The Cruz family', 'March 14, 2099', '10:00 AM']],
];

for (const [name, prefix, details, expected] of CASES) {
  test(`${name}: occasion fields, RSVP and countdown, no cover by default`, () => {
    const html = render(name, details);
    for (const s of [...expected, 'id="rsvp"', 'class="cd ', `class="inv ${prefix}"`]) assert.ok(html.includes(s), s);
    assert.doesNotMatch(html, /inv-cover/);
    assert.doesNotMatch(html, /<img/);
  });

  test(`${name}: cover goes in the hero and out of the gallery; a font fills --serif`, () => {
    const html = render(name, details, ['a.jpg', 'b.jpg', 'c.jpg'], { font: 'modern', cover: COVER });
    assert.match(html, new RegExp(`class="${prefix}-hero inv-cover"`));
    assert.match(html, /--cover-overlay:rgba\(0,0,0,0.4\)/);
    assert.match(html, /--serif:&#x27;DM Serif Display&#x27;/);
    assert.equal(html.match(/src="b\.jpg"/g).length, 1); // only the cover layer
    assert.ok(html.includes('a.jpg') && html.includes('c.jpg'));
    assert.match(html, /photo 1 of 2/);
  });

  test(`${name}: old style {} and minimal details render`, () => {
    const min = { ...details, schedule: [], message: undefined, dressCode: undefined, giftsNote: undefined, rsvpDeadline: undefined, hostedBy: undefined };
    const html = renderToStaticMarkup(createElement(L[name], { details: min, scheme, photos: [], style: {} }));
    assert.ok(html.includes(`class="inv ${prefix}"`));
    assert.doesNotMatch(html, /undefined|Kindly reply|id="rsvp"/);
  });
}

test('Pastel without an age still renders', () => {
  const html = render('Pastel', { ...BIRTHDAY, age: undefined });
  assert.ok(html.includes('Mia'));
  assert.doesNotMatch(html, /<sup>/);
});

test('each new layout has its own CSS block', () => {
  const css = readFileSync(new URL('../src/invitations/invitations.css', import.meta.url), 'utf8');
  for (const p of ['ed', 'mn', 'st', 'ps']) assert.match(css, new RegExp(`\\.${p}-hero[ .,{:]`), p);
});
