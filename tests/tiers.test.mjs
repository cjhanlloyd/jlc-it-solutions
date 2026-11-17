import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoLimit, retentionDays, tierOf } from '../shared/tiers.ts';
import { validatePackages } from '../shared/packages.ts';
import { validateStyle } from '../shared/invitation-style.ts';

const pkg = (extra = {}) => [{ key: 'a', name: 'A', priceCentavos: 5000, inclusions: [], kind: 'template', ...extra }];

test('limits per tier', () => {
  assert.equal(photoLimit('standard'), 6);
  assert.equal(photoLimit('premium'), 12);
  assert.equal(retentionDays('standard'), 60);
  assert.equal(retentionDays('premium'), 183);
});

test('tierOf defaults to standard', () => {
  assert.equal(tierOf({}), 'standard');
  assert.equal(tierOf(null), 'standard');
  assert.equal(tierOf({ tier: 'gold' }), 'standard');
  assert.equal(tierOf({ tier: 'premium' }), 'premium');
});

test('validatePackages handles tier', () => {
  assert.equal(validatePackages(pkg({ tier: 'premium' })).packages[0].tier, 'premium');
  assert.equal(validatePackages(pkg({ tier: 'standard' })).packages[0].tier, 'standard');
  assert.ok(!('tier' in validatePackages(pkg()).packages[0]));
  assert.match(validatePackages(pkg({ tier: 'gold' })).error, /tier/i);
});

test('intro and music are premium only', () => {
  assert.ok('error' in validateStyle({ music: 3 }, { tier: 'standard', trackIds: [3] }));
  assert.ok('error' in validateStyle({ intro: true }, {}));
  const s = { music: 3, intro: false };
  assert.deepEqual(validateStyle(s, { tier: 'premium', trackIds: [3] }), { style: s });
  assert.ok('error' in validateStyle({ music: 4 }, { tier: 'premium', trackIds: [3] }));
  assert.ok('error' in validateStyle({ intro: 'yes' }, { tier: 'premium' }));
});
