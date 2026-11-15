// Occasion chips on the shop: labels for product types, shown only once there are 2+ occasions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { occasionLabel, occasionChips } from '../src/invitations/occasions.ts';

test('labels', () => {
  assert.equal(occasionLabel('wedding_invitation'), 'Wedding');
  assert.equal(occasionLabel('debut_invitation'), 'Debut');
  assert.equal(occasionLabel('graduation_party_invitation'), 'Graduation party');
});
test('chips only when 2+ occasions', () => {
  assert.deepEqual(occasionChips(['wedding_invitation', 'wedding_invitation']), []);
  assert.deepEqual(occasionChips(['wedding_invitation', 'debut_invitation', 'wedding_invitation']), ['wedding_invitation', 'debut_invitation']);
});
