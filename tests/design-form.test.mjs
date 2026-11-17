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

test('package tier round-trips through the editor rows; no tier stays standard', async () => {
  const { bundle } = await import('./helpers/bundle.mjs');
  const { toRows, toPackages } = await bundle('src/admin/PackagesEditor.tsx');
  const base = { key: 'a', name: 'A', priceCentavos: 100000, kind: 'template', inclusions: ['x'] };
  const prem = toPackages(toRows([{ ...base, tier: 'premium' }]));
  assert.equal(prem[0].tier, 'premium');
  assert.equal('tier' in toPackages(toRows([base]))[0], false);
  assert.equal('tier' in toPackages([{ ...toRows([{ ...base, tier: 'premium' }])[0], kind: 'custom' }])[0], false);
});

test('isPremium: any template package with tier premium', async () => {
  const { bundle } = await import('./helpers/bundle.mjs');
  const { isPremium } = await bundle('src/site/design-tier.ts');
  const p = (kind, tier) => ({ kind, tier });
  assert.equal(isPremium({ packages: [p('template'), p('template', 'premium')] }), true);
  assert.equal(isPremium({ packages: [p('template'), p('custom', 'premium')] }), false);
  assert.equal(isPremium({ packages: [p('template')] }), false);
});
