import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
const hex = (name) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token ${name} missing`);
  return m[1];
};
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('palette values are the agreed ones', () => {
  assert.equal(hex('brand-700').toLowerCase(), '#1f3d2b');
  assert.equal(hex('ivory').toLowerCase(), '#fbf7f0');
  assert.equal(hex('ink').toLowerCase(), '#2b2420');
  assert.equal(hex('gold').toLowerCase(), '#a8843f');
});

test('white on brand-700 is at least 4.5:1', () => {
  assert.ok(contrast('#ffffff', hex('brand-700')) >= 4.5);
});

test('ink on ivory is at least 7:1', () => {
  assert.ok(contrast(hex('ink'), hex('ivory')) >= 7);
});
