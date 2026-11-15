import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { splitAnswer } = await bundle('src/site/faq-text.ts');

test('splitAnswer: plain text, safe links, unsafe links downgraded', () => {
  assert.deepEqual(splitAnswer('Just text.'), [{ text: 'Just text.' }]);
  assert.deepEqual(splitAnswer('See [policy](/refund-policy) or [us](https://a.com/x).'), [
    { text: 'See ' }, { text: 'policy', href: '/refund-policy' }, { text: ' or ' }, { text: 'us', href: 'https://a.com/x' }, { text: '.' },
  ]);
  assert.deepEqual(splitAnswer('[x](javascript:evil) [y](//evil.com) [z](http://a.com)'), [
    { text: 'x' }, { text: ' ' }, { text: 'y' }, { text: ' ' }, { text: 'z' },
  ]);
});
