// Marketplace filtering, sorting and URL state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDesigns, parseQuery, toQuery } from '../src/site/design-filter.ts';

const d = (slug, name, productType, priceCentavos, featured = false) => ({ slug, name, productType, priceCentavos, fromPriceCentavos: priceCentavos, featured });
const L = [
  d('a', 'Garden Bloom', 'wedding_invitation', 50000),
  d('b', 'Confetti Pop', 'birthday_invitation', 30000, true),
  d('c', 'Gold Gala', 'debut_invitation', 30000),
  d('e', 'Rose Vow', 'wedding_invitation', 40000, true),
];
const slugs = (x) => x.map((i) => i.slug);
const base = { q: '', occasion: 'all', sort: 'featured' };

test('featured sort puts featured first, keeping sort order', () => {
  assert.deepEqual(slugs(filterDesigns(L, base)), ['b', 'e', 'a', 'c']);
});
test('price-asc is stable for equal prices', () => {
  assert.deepEqual(slugs(filterDesigns(L, { ...base, sort: 'price-asc' })), ['b', 'c', 'e', 'a']);
});
test('q matches name or occasion label, case-insensitive and trimmed', () => {
  assert.deepEqual(slugs(filterDesigns(L, { ...base, q: '  GARDEN ' })), ['a']);
  assert.deepEqual(slugs(filterDesigns(L, { ...base, q: 'wedding' })), ['e', 'a']);
});
test('occasion filters exactly; unknown occasion gives none', () => {
  assert.deepEqual(slugs(filterDesigns(L, { ...base, occasion: 'debut_invitation' })), ['c']);
  assert.deepEqual(filterDesigns(L, { ...base, occasion: 'nope' }), []);
});
test('does not mutate the input', () => {
  const copy = slugs(L);
  filterDesigns(L, { ...base, sort: 'price-asc' });
  assert.deepEqual(slugs(L), copy);
});
test('parseQuery defaults and rejects unknown sort', () => {
  assert.deepEqual(parseQuery(''), base);
  assert.deepEqual(parseQuery('?q=rose&occasion=debut_invitation&sort=price-asc'), { q: 'rose', occasion: 'debut_invitation', sort: 'price-asc' });
  assert.equal(parseQuery('?sort=bogus').sort, 'featured');
});
test('toQuery omits defaults and round-trips', () => {
  assert.equal(toQuery(base), '');
  const s = { q: 'a b', occasion: 'debut_invitation', sort: 'price-asc' };
  assert.deepEqual(parseQuery(toQuery(s)), s);
});
