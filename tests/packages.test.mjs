import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackages, fromPrice, pickPackage, resolveOrderPackage } from '../shared/packages.ts';

const P = (o = {}) => ({ key: 'standard', name: 'Standard', priceCentavos: 50000, inclusions: ['a'], kind: 'template', ...o });
const err = (input) => { const r = validatePackages(input); assert.equal(r.ok, false); return r.error; };

test('valid single and multiple, trims and drops empty inclusions', () => {
  const r = validatePackages([P({ name: '  Std ', inclusions: [' x ', '  ', 'y'] }), P({ key: 'pro', kind: 'custom', priceCentavos: 1000 })]);
  assert.equal(r.ok, true);
  assert.equal(r.packages[0].name, 'Std');
  assert.deepEqual(r.packages[0].inclusions, ['x', 'y']);
  assert.equal(validatePackages([P()]).ok, true);
});

test('rule violations', () => {
  assert.match(err('x'), /package/i);
  assert.equal(err([]), 'Each design needs 1 to 4 packages.');
  assert.equal(err([1, 2, 3, 4, 5].map((i) => P({ key: 'k' + i }))), 'Each design needs 1 to 4 packages.');
  assert.equal(err([P({ kind: 'custom' })]), 'Each design needs at least one package that can be ordered online.');
  assert.equal(err([P(), P()]), 'Package keys must be unique.');
  assert.match(err([P({ key: 'Bad Key' })]), /key/i);
  assert.match(err([P({ name: '' })]), /name/i);
  assert.match(err([P({ name: 'x'.repeat(41) })]), /name/i);
  assert.equal(err([P({ priceCentavos: 999 })]), 'Package price must be between ₱10 and ₱100,000.');
  assert.equal(err([P({ priceCentavos: 10000001 })]), 'Package price must be between ₱10 and ₱100,000.');
  assert.equal(err([P({ priceCentavos: 1000.5 })]), 'Package price must be between ₱10 and ₱100,000.');
  assert.match(err([P({ inclusions: Array(11).fill('a') })]), /inclusion/i);
  assert.match(err([P({ inclusions: ['x'.repeat(81)] })]), /inclusion/i);
  assert.match(err([P({ kind: 'weird' })]), /kind|type/i);
});

test('fromPrice ignores custom; pickPackage fallback and prototype keys', () => {
  const pk = [P({ key: 'c', kind: 'custom', priceCentavos: 1000 }), P({ key: 'a', priceCentavos: 90000 }), P({ key: 'b', priceCentavos: 70000 })];
  assert.equal(fromPrice(pk), 70000);
  assert.equal(pickPackage(pk, 'b').key, 'b');
  assert.equal(pickPackage(pk, 'c').key, 'c');
  assert.equal(pickPackage(pk, 'nope').key, 'a');
  assert.equal(pickPackage(pk).key, 'a');
  assert.equal(pickPackage(pk, '__proto__').key, 'a');
  assert.equal(pickPackage([pk[0]], 'x'), null);
});

import { resolvePackage } from '../shared/packages.ts';
test('resolvePackage: exact template key, else first template, never custom', () => {
  const pk = [
    { key: 'basic', name: 'Basic', priceCentavos: 1000, inclusions: [], kind: 'template' },
    { key: 'prem', name: 'Premium', priceCentavos: 2000, inclusions: [], kind: 'template' },
    { key: 'cust', name: 'Custom', priceCentavos: 9000, inclusions: [], kind: 'custom' },
  ];
  assert.equal(resolvePackage(pk, 'prem').key, 'prem');
  assert.equal(resolvePackage(pk, 'cust').key, 'basic');
  assert.equal(resolvePackage(pk, 'nope').key, 'basic');
  assert.equal(resolvePackage(pk).key, 'basic');
  assert.equal(resolvePackage([pk[2]]), null);
});

test('resolveOrderPackage resolves custom keys, falls back to first template', () => {
  const pk = [P(), P({ key: 'made', kind: 'custom' })];
  assert.equal(resolveOrderPackage(pk, 'made').key, 'made');
  assert.equal(resolveOrderPackage(pk, 'nope').key, 'standard');
  assert.equal(resolveOrderPackage(pk).key, 'standard');
  assert.equal(resolveOrderPackage([P({ kind: 'custom' })], 'x'), null);
});
