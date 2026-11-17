import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { validateExtras, ATTIRE_PHOTOS_MAX, GUEST_UPLOAD_PER_BATCH, GUEST_PHOTOS_MAX, GIFT_ITEMS_MAX } = await bundle('shared/extras.ts');
const ok = (x, t = 'premium') => { const r = validateExtras(x, t); assert.ok(r.extras, JSON.stringify(r)); return r.extras; };
const bad = (x, msg, t = 'premium') => { const r = validateExtras(x, t); assert.ok(r.error, 'expected an error'); if (msg) assert.match(r.error, msg); };

test('empty and full valid settings pass; strings are trimmed and hex lowercased', () => {
  assert.deepEqual(ok({}, 'standard'), {});
  const full = {
    attire: { motif: '  Garden  ', palette: ['#D8A7B1', '#aabbcc'], notes: ' Line one\nline two ' },
    gallery: { layout: 'masonry' }, guestPhotos: { enabled: true }, booth: { enabled: true, frame: 'film' }, checkin: { enabled: false },
    gifts: { methods: [{ label: ' GCash ', accountName: ' Maria ', accountNumber: ' 0917 ' }, { label: 'BPI', accountNumber: '123' }] },
  };
  assert.deepEqual(ok(full), { ...full, attire: { motif: 'Garden', palette: ['#d8a7b1', '#aabbcc'], notes: 'Line one\nline two' },
    gifts: { methods: [{ label: 'GCash', accountName: 'Maria', accountNumber: '0917' }, { label: 'BPI', accountNumber: '123' }] } });
});

test('Standard keeps attire, gallery and gifts but cannot use Premium features', () => {
  ok({ attire: { motif: 'x' }, gallery: { layout: 'carousel' }, gifts: { methods: [] } }, 'standard');
  bad({ guestPhotos: { enabled: true } }, /^Guest photos is a Premium feature\.$/, 'standard');
  bad({ booth: {} }, /^Photo booth is a Premium feature\.$/, 'standard');
  bad({ checkin: { enabled: false } }, /^Check-in is a Premium feature\.$/, 'standard');
});

test('unknown keys are rejected at every level, and non-objects too', () => {
  bad({ nope: 1 }, /Unknown setting: Settings\.nope/);
  bad({ attire: { colour: 1 } }, /attire\.colour/);
  bad({ gallery: { x: 1 } }, /gallery\.x/);
  bad({ guestPhotos: { x: 1 } }, /guestPhotos\.x/);
  bad({ booth: { x: 1 } }, /booth\.x/);
  bad({ checkin: { x: 1 } }, /checkin\.x/);
  bad({ gifts: { x: 1 } }, /gifts\.x/);
  bad({ gifts: { methods: [{ label: 'a', accountNumber: '1', x: 1 }] } }, /method\.x/);
  for (const v of [null, [], 'x', 5]) bad(v, /must be an object/);
  bad({ attire: [] }, /must be an object/);
});

test('attire limits', () => {
  ok({ attire: { motif: 'a'.repeat(120), notes: 'a'.repeat(600), palette: Array(6).fill('#000000') } });
  bad({ attire: { motif: 'a'.repeat(121) } }, /Motif/);
  bad({ attire: { motif: 5 } }, /must be text/);
  bad({ attire: { notes: 'a'.repeat(601) } }, /notes/);
  bad({ attire: { palette: Array(7).fill('#000000') } }, /up to 6/);
  bad({ attire: { palette: 'red' } }, /up to 6/);
  bad({ attire: { palette: ['#fff'] } }, /#d8a7b1/);
  bad({ attire: { palette: [5] } }, /#d8a7b1/);
});

test('gallery layout, booth frame and booleans', () => {
  for (const l of ['grid', 'masonry', 'carousel', 'polaroid']) ok({ gallery: { layout: l } });
  for (const f of ['classic', 'polaroid', 'film', 'floral']) ok({ booth: { frame: f } });
  bad({ gallery: { layout: 'wall' } }, /one of: grid/);
  bad({ booth: { frame: 'star' } }, /one of: classic/);
  bad({ guestPhotos: { enabled: 'yes' } }, /true or false/);
  bad({ booth: { enabled: 1 } }, /true or false/);
  bad({ checkin: { enabled: null } }, /true or false/);
});

test('cash gift methods', () => {
  const m = (o) => ({ gifts: { methods: [{ label: 'GCash', accountNumber: '1', ...o }] } });
  ok({ gifts: { methods: Array(4).fill({ label: 'a', accountNumber: '1' }) } });
  bad({ gifts: { methods: Array(5).fill({ label: 'a', accountNumber: '1' }) } }, /up to 4/);
  bad({ gifts: { methods: 'x' } }, /up to 4/);
  bad({ gifts: { methods: ['x'] } }, /must be an object/);
  bad(m({ label: '  ' }), /Method name is required/);
  bad(m({ label: undefined }), /must be text/);
  bad(m({ label: 'a'.repeat(31) }), /30/);
  bad(m({ accountNumber: '' }), /Account number is required/);
  bad(m({ accountNumber: 'a'.repeat(41) }), /40/);
  bad(m({ accountName: 'a'.repeat(61) }), /60/);
  bad(m({ accountName: 5 }), /must be text/);
});

test('exported limits', () => {
  assert.deepEqual([ATTIRE_PHOTOS_MAX, GUEST_UPLOAD_PER_BATCH, GUEST_PHOTOS_MAX, GIFT_ITEMS_MAX], [6, 5, 500, 50]);
});
