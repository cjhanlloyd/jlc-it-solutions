// Home page featured designs: the featured ones in sort order, else the first few.
import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredDesigns } from '../src/site/home-content.ts';

const d = (slug, featured = false) => ({ slug, featured });
const slugs = (list) => list.map((x) => x.slug);

test('featured designs come first, in sort order', () => {
  assert.deepEqual(slugs(featuredDesigns([d('a'), d('b', true), d('c'), d('e', true)])), ['b', 'e']);
});

test('featured designs are capped at max', () => {
  const all = Array.from({ length: 8 }, (_, i) => d(`f${i}`, true));
  assert.deepEqual(slugs(featuredDesigns(all)), ['f0', 'f1', 'f2', 'f3', 'f4', 'f5']);
  assert.deepEqual(slugs(featuredDesigns(all, 2)), ['f0', 'f1']);
});

test('no featured designs: the first max in sort order', () => {
  const all = Array.from({ length: 9 }, (_, i) => d(`d${i}`));
  assert.deepEqual(slugs(featuredDesigns(all)), ['d0', 'd1', 'd2', 'd3', 'd4', 'd5']);
  assert.deepEqual(slugs(featuredDesigns(all.slice(0, 3))), ['d0', 'd1', 'd2']);
});

test('empty list gives none', () => {
  assert.deepEqual(featuredDesigns([]), []);
});
