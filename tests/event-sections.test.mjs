// Attire & motif and Gifts inside the 11 layouts: pure helpers, unchanged output without extras, and the new sections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { hasAttire, hasGiftExtras, legacyNotes, peso, wishState } from '../src/invitations/event-view.ts';

test('which sections show, and what stays in the old notes block', () => {
  assert.equal(hasAttire(undefined), false);
  assert.equal(hasAttire({ attire: {}, attirePhotos: [] }), false);
  assert.equal(hasAttire({ attire: { palette: ['#d8a7b1'] } }), true);
  assert.equal(hasAttire({ attirePhotos: [{ url: '/photos/a.jpg' }] }), true);
  assert.equal(hasGiftExtras({ giftItems: [], giftMethods: [] }), false);
  assert.equal(hasGiftExtras({ giftMethods: [{ label: 'GCash', accountNumber: '0917' }] }), true);
  assert.deepEqual(legacyNotes(undefined, 'Formal', 'Your presence', 'qr.png'), { dress: 'Formal', gifts: 'Your presence' });
  assert.deepEqual(legacyNotes({}, '', '', 'qr.png'), { dress: '', gifts: 'qr.png' });
  assert.deepEqual(legacyNotes({ attire: { motif: 'Rose' }, giftItems: [{ id: 1, name: 'Mixer', reserved: false }] }, 'Formal', 'Note', 'qr.png'), { dress: '', gifts: '' });
});

test('price formatting and the reserve button state', () => {
  assert.equal(peso(250000), '₱2,500');
  assert.equal(peso(129950), '₱1,299.5');
  const open = { id: 1, name: 'Mixer', reserved: false };
  assert.equal(wishState(open, false), 'none');
  assert.equal(wishState(open, true), 'open');
  assert.equal(wishState({ ...open, reserved: true }, true), 'reserved');
  assert.equal(wishState({ ...open, reserved: true, reservedByYou: true }, true), 'yours');
  assert.equal(wishState({ ...open, reserved: true }, false), 'none');
});

const NAMES = ['Classic', 'Garden', 'Modern', 'Confetti', 'Golden', 'Blush', 'Portrait', 'Editorial', 'Minimal', 'Starlight', 'Pastel'];
const outdir = fileURLToPath(new URL('../node_modules/.cache/jlc-tests/event-sections', import.meta.url));
await build({
  entryPoints: NAMES.map((n) => fileURLToPath(new URL(`../src/invitations/layouts/${n}.tsx`, import.meta.url))),
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outdir, outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const L = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, (await import(pathToFileURL(`${outdir}/${n}.mjs`).href)).default])));

const scheme = { primary: '#8b1e3f', accent: '#c9a66b', background: '#fbf7f2', text: '#2b2b2b' };
const v = (name) => ({ name, address: name + ' St', mapUrl: 'https://maps.example/' + name.length });
const notes = { dressCode: 'Formal', giftsNote: 'Your presence is enough' };
const WEDDING = { partner1: 'Maria', partner2: 'Juan', eventDate: '2099-02-14', eventTime: '15:30', ceremony: v('San Agustin'), reception: v('Manila Hotel'), schedule: [], ...notes };
const DEBUT = { debutante: 'Sofia', eventDate: '2099-05-01', eventTime: '18:00', venue: v('Ballroom'), schedule: [], ...notes };
const BIRTHDAY = { celebrant: 'Mia', age: 7, eventDate: '2099-03-14', eventTime: '10:00', venue: v('Party Room'), schedule: [], ...notes };
const DETAILS = { Confetti: BIRTHDAY, Golden: BIRTHDAY, Pastel: BIRTHDAY, Blush: DEBUT, Starlight: DEBUT };
const render = (name, extra = {}, details = DETAILS[name] ?? WEDDING) =>
  renderToStaticMarkup(createElement(L[name], { details, scheme, photos: [], style: {}, giftQr: '/photos/qr.png', ...extra }));

const ATTIRE = {
  attire: { motif: 'Garden formal', palette: ['#d8a7b1', '#9caf88'], notes: 'Long gowns\nNo white, please' },
  attirePhotos: [{ url: '/photos/inv/1/attire-1.jpg', caption: 'Sage gown' }, { url: '/photos/inv/1/attire-2.jpg', caption: '' }],
};
const ITEMS = [
  { id: 1, name: 'Stand mixer', note: 'Any colour', link: 'https://shop.example/mixer', priceCentavos: 1299900, reserved: false },
  { id: 2, name: 'Towels', reserved: true },
  { id: 3, name: 'Dinner set', reserved: true, reservedByYou: true },
];
const METHODS = [{ label: 'GCash', accountName: 'Maria Cruz', accountNumber: '0917 123 4567' }];

for (const name of NAMES) {
  test(`${name}: empty extras render exactly as before, and a note with a QR keeps the old gift block`, () => {
    const before = render(name);
    assert.equal(render(name, { events: {} }), before);
    assert.equal(render(name, { events: { attire: {}, attirePhotos: [], giftItems: [], giftMethods: [], onReserve: () => {} } }), before);
    assert.ok(before.includes('Your presence is enough') && before.includes('/photos/qr.png'));
    assert.doesNotMatch(before, /inv-ev|Attire &amp; motif|Wish list|Cash gifts/);
  });

  test(`${name}: attire and gifts sections with everything set`, () => {
    const html = render(name, { events: { ...ATTIRE, giftItems: ITEMS, giftMethods: METHODS, onReserve: () => {}, onRelease: () => {} } });
    for (const s of ['Attire &amp; motif', 'Garden formal', 'aria-label="Colour #d8a7b1"', 'aria-label="Colour #9caf88"', 'Long gowns\nNo white, please', 'Sage gown',
      'href="/photos/inv/1/attire-1.jpg" target="_blank" rel="noopener noreferrer" aria-label="Attire photo 1: Sage gown, open full size in a new tab"',
      'aria-label="Attire photo 2, open full size in a new tab"', 'Dress code', 'Formal',
      '>Gifts<', 'Your presence is enough', 'Wish list', 'Stand mixer', '₱12,999', 'Any colour', 'href="https://shop.example/mixer" target="_blank" rel="noopener noreferrer"',
      'I&#x27;ll give this', 'disabled="" aria-disabled="true">Reserved<', 'You&#x27;re giving this', 'Undo',
      'Cash gifts', 'Scan or send to any of the accounts below.', 'GCash', 'Maria Cruz', '0917 123 4567', 'Copy', 'aria-live="polite"', '/photos/qr.png']) {
      assert.ok(html.includes(s), `${name}: ${s}`);
    }
    // The dress code, note and QR moved into the new sections, so they appear once
    assert.equal(html.split('Your presence is enough').length, 2);
    assert.equal(html.split('alt="Gift QR code"').length, 2);
    assert.doesNotMatch(html, /Good to know|A few notes/);
  });
}

test('previews (no handlers) show the wish list without reserve buttons', () => {
  const html = render('Classic', { events: { giftItems: ITEMS } });
  assert.ok(html.includes('Stand mixer') && html.includes('Wish list'));
  assert.doesNotMatch(html, /give this|Reserved|giving this/);
  // only the wish list is new; the note and QR still show, under Cash gifts
  assert.ok(html.includes('Cash gifts') && html.includes('/photos/qr.png'));
});

test('attire alone leaves the gift block as it was and takes the dress code', () => {
  const html = render('Editorial', { events: ATTIRE });
  assert.ok(html.includes('id="ed-attire"') && html.includes('id="ed-notes"'));
  assert.ok(html.indexOf('Formal') > html.indexOf('id="ed-attire"'));
  assert.doesNotMatch(html, /id="ed-gifts"/);
  // Modern keeps its own Gifts row and gets an Attire & motif row in place of the dress-code row
  const md = render('Modern', { events: ATTIRE });
  assert.ok(md.includes('id="md-gifts"') && md.includes('id="md-attire"') && md.includes('class="md-label">Attire &amp; motif'));
});

test('a reservation message shows on its card, as an alert when it is an error', () => {
  const html = render('Pastel', { events: { giftItems: ITEMS, onReserve: () => {}, wishMessage: { id: 2, text: 'Someone already chose this gift.', error: true } } });
  assert.ok(html.includes('role="alert">Someone already chose this gift.'));
  const thanks = render('Pastel', { events: { giftItems: ITEMS, onReserve: () => {}, wishMessage: { id: 1, text: 'Thank you!' } } });
  assert.ok(thanks.includes('role="status">Thank you!'));
});
