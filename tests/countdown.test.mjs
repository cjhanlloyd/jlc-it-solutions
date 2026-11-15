import test from 'node:test';
import assert from 'node:assert/strict';
import { timeLeft } from '../src/invitations/countdown.ts';

const now = Date.parse('2026-11-13T00:00:00Z');

test('days, hours and minutes left', () => {
  assert.equal(timeLeft('2026-11-15T03:20:00Z', now), '2d 3h 20m');
  assert.equal(timeLeft('2026-11-13T05:07:30Z', now), '5h 8m');
  assert.equal(timeLeft('2026-11-13T00:00:40Z', now), '1m');
});

test('past, now or missing deadline gives null', () => {
  assert.equal(timeLeft('2026-11-13T00:00:00Z', now), null);
  assert.equal(timeLeft('2026-11-12T00:00:00Z', now), null);
  assert.equal(timeLeft(null, now), null);
  assert.equal(timeLeft('garbage', now), null);
});
