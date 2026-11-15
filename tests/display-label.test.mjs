import test from 'node:test';
import assert from 'node:assert/strict';
import { displayLabel } from '../src/admin/displayLabel.ts';

test('displayLabel title-cases raw values and keeps readable ones', () => {
  assert.equal(displayLabel('in_progress'), 'In Progress');
  assert.equal(displayLabel('Converted'), 'Converted');
  assert.equal(displayLabel('web development'), 'Web Development');
  assert.equal(displayLabel('IT Support'), 'IT Support');
});
