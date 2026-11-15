import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, STATUS_LABEL, CUSTOMER_MESSAGE, canTransition, isFinal, PAID_STATUSES } from '../shared/order-status.ts';

test('allowed and forbidden transitions', () => {
  assert.equal(canTransition('pending_payment', 'payment_verification'), true);
  assert.equal(canTransition('pending_payment', 'payment_confirmed'), false);
  assert.equal(canTransition('payment_confirmed', 'cancelled'), false);
  assert.equal(canTransition('delivered', 'refunded'), true);
  assert.equal(canTransition('for_review', 'delivered'), true);
});

test('final statuses go nowhere', () => {
  for (const f of ['cancelled', 'refunded']) {
    assert.equal(isFinal(f), true);
    for (const s of STATUSES) assert.equal(canTransition(f, s), false);
  }
  assert.equal(isFinal('delivered'), false);
});

test('unknown codes are false', () => {
  assert.equal(canTransition('nope', 'cancelled'), false);
  assert.equal(canTransition('pending_payment', 'nope'), false);
  assert.equal(canTransition('constructor', 'cancelled'), false);
  assert.equal(canTransition('__proto__', 'cancelled'), false);
  assert.equal(canTransition('pending_payment', '__proto__'), false);
});

test('labels, messages, paid set', () => {
  assert.equal(STATUSES.length, 10);
  for (const s of STATUSES) {
    assert.ok(STATUS_LABEL[s]);
    assert.ok(CUSTOMER_MESSAGE[s]);
    assert.ok(!/paymongo/i.test(CUSTOMER_MESSAGE[s]));
  }
  assert.deepEqual([...PAID_STATUSES], ['payment_confirmed', 'in_production', 'for_review', 'revision_requested', 'completed', 'delivered']);
});
