// Standard/Premium comparison data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tierPrices, TIER_FEATURES } from '../src/site/tier-prices.ts';
import { photoLimit, retentionDays } from '../shared/tiers.ts';

const pk = (priceCentavos, tier, kind = 'template') => ({ key: `${kind}-${priceCentavos}-${tier}`, name: 'x', priceCentavos, kind, ...(tier ? { tier } : {}) });
const d = (productType, ...packages) => ({ productType, packages });

test('lowest template price per tier and occasion', () => {
  const r = tierPrices([d('wedding_invitation', pk(149900, 'standard'), pk(299900, 'premium')), d('wedding_invitation', pk(129900, 'standard'), pk(399900, 'premium'))]);
  assert.deepEqual(r, [{ productType: 'wedding_invitation', standard: 129900, premium: 299900 }]);
});
test('custom packages are ignored and a missing tier is null', () => {
  const r = tierPrices([d('debut_invitation', pk(10000, 'standard'), pk(5000, 'premium', 'custom'))]);
  assert.deepEqual(r, [{ productType: 'debut_invitation', standard: 10000, premium: null }]);
});
test('packages without a tier count as standard', () => {
  assert.equal(tierPrices([d('birthday_invitation', pk(99900))])[0].standard, 99900);
});
test('occasions: wedding, debut, birthday, then others alphabetically', () => {
  const r = tierPrices(['zeta', 'birthday_invitation', 'alpha', 'debut_invitation', 'wedding_invitation'].map((t) => d(t, pk(1))));
  assert.deepEqual(r.map((x) => x.productType), ['wedding_invitation', 'debut_invitation', 'birthday_invitation', 'alpha', 'zeta']);
});
test('no designs gives no rows', () => assert.deepEqual(tierPrices([]), []));
test('feature photo and retention values follow the tier rules', () => {
  const f = (label) => TIER_FEATURES.find((x) => x.label === label);
  assert.equal(f('Photo gallery').standard, `Up to ${photoLimit('standard')}`);
  assert.equal(f('Photo gallery').premium, `Up to ${photoLimit('premium')}`);
  assert.equal(retentionDays('standard'), 60);
  assert.equal(f('Online after the event').standard, '60 days');
  assert.equal(f('Online after the event').premium, '6 months');
  assert.ok(retentionDays('premium') > 180 && retentionDays('premium') < 186);
});
