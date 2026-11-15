import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, pesosToCentavos, centavosToPesos, move } from '../src/admin/design-form.ts';

test('slugify', () => {
  assert.equal(slugify('  Rose & Gold Wedding! '), 'rose-gold-wedding');
  assert.equal(slugify('Débutante Éclat'), 'debutante-eclat');
  assert.equal(slugify('Premium Package', 8), 'premium');
  assert.equal(slugify('!!!'), '');
});

test('pesos ↔ centavos', () => {
  assert.equal(pesosToCentavos('999'), 99900);
  assert.equal(pesosToCentavos('1,499.50'), 149950);
  assert.equal(pesosToCentavos('₱ 10.05'), 1005);
  assert.ok(Number.isNaN(pesosToCentavos('')));
  assert.ok(Number.isNaN(pesosToCentavos('abc')));
  assert.ok(Number.isNaN(pesosToCentavos('1.234')));
  assert.equal(centavosToPesos(149950), '1499.5');
});

test('move', () => {
  assert.deepEqual(move([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(move([1, 2, 3], 2, -1), [1, 3, 2]);
  const l = [1, 2];
  assert.equal(move(l, 0, -1), l);
  assert.equal(move(l, 1, 1), l);
});
