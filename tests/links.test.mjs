import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { isSafeLink } = await bundle('shared/links.ts');

test('isSafeLink', () => {
  for (const u of ['/refund-policy', '/', 'https://jlcitsolutions.com/x']) assert.equal(isSafeLink(u), true, u);
  for (const u of ['/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', 'https://a b', '//evil.com', 'http://x', 'javascript:alert(1)', '']) assert.equal(isSafeLink(u), false, JSON.stringify(u));
});
