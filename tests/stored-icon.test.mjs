import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKebab, isKnownIcon } from '../src/components/icon-name.ts';

test('toKebab converts stored PascalCase names to lucide names', () => {
  assert.equal(toKebab('Shield'), 'shield');
  assert.equal(toKebab('HelpCircle'), 'help-circle');
  assert.equal(toKebab('BarChart3'), 'bar-chart-3');
  assert.equal(toKebab(''), '');
});

test('isKnownIcon accepts real icons and rejects unknown or empty names', () => {
  assert.equal(isKnownIcon('Shield'), true);
  assert.equal(isKnownIcon('HelpCircle'), true);
  assert.equal(isKnownIcon('Foo'), false);
  assert.equal(isKnownIcon(''), false);
  assert.equal(isKnownIcon(undefined), false);
});

test('every lucide component export resolves to a known dynamic icon', async () => {
  const lucide = await import('lucide-react');
  const names = Object.keys(lucide).filter((n) => /^[A-Z]/.test(n) && !n.endsWith('Icon') && !n.startsWith('Lucide') && typeof lucide[n] === 'object' && lucide[n].render);
  assert.ok(names.length > 1000);
  const bad = names.filter((n) => !isKnownIcon(n));
  assert.deepEqual(bad, []);
});
