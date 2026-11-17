// The Premium opening's wax-seal monogram. Run: node --test tests/intro-cover.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

test('monogram takes the first letter of each name', async () => {
  const { monogram } = await bundle('src/invitations/IntroCover.tsx');
  assert.equal(monogram('Maria & Juan'), 'M&J');
  assert.equal(monogram('mia'), 'M');
  assert.equal(monogram('Ánge & Ömer'), 'Á&Ö');
  assert.equal(monogram(' & Juan'), 'J');
  assert.equal(monogram(''), '');
});
