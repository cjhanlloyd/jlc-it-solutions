// Stacked deck poses: the front card follows the drag, two cards fan out behind it, the previous card waits off to the left.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { cardPose } = await bundle('src/site/deck-pose.ts');

test('front card follows the drag and sits on top', () => {
  const p = cardPose(0, 5, -40);
  assert.match(p.transform, /translate3d\(-40px,0,0\)/);
  assert.equal(p.opacity, 1);
  assert.ok(p.z > cardPose(1, 5).z);
});

test('two cards fan out behind, the rest are hidden, the previous waits off-screen left', () => {
  assert.ok(cardPose(1, 5).opacity > 0 && cardPose(2, 5).opacity > 0);
  assert.equal(cardPose(3, 5).opacity, 0);
  assert.match(cardPose(4, 5).transform, /-115%/);
  assert.equal(cardPose(4, 5).opacity, 0);
});

test('a two-card deck keeps the second card behind, not off-screen', () => {
  assert.ok(cardPose(1, 2).opacity > 0);
  assert.doesNotMatch(cardPose(1, 2).transform, /-115%/);
});
