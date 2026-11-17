import test from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { visibleGroups, isActive, NAV } = await bundle('src/admin/navConfig.ts');
const labels = (role) => visibleGroups(role).map((g) => [g.label, g.items.map((i) => i.label)]);

test('Editor sees only Dashboard, Orders and Invitations & RSVPs', () => {
  assert.deepEqual(labels('Editor'), [['Overview', ['Dashboard']], ['Sales', ['Orders', 'Invitations & RSVPs']]]);
});

test('Super Admin sees all 15 items in 5 groups', () => {
  const g = visibleGroups('Super Admin');
  assert.equal(g.length, 5);
  assert.equal(g.flatMap((x) => x.items).length, 15);
});

test('Administrator sees no Settings group and only Activity under Team', () => {
  const names = visibleGroups('Administrator').map((g) => g.label);
  assert.deepEqual(names, ['Overview', 'Sales', 'Catalogue & website', 'Team']);
});

test('detail pages highlight their list item', () => {
  const item = (id) => NAV.flatMap((g) => g.items).find((i) => i.id === id);
  assert.ok(isActive('order', item('orders')));
  assert.ok(isActive('inquiry', item('inquiries')));
  assert.ok(isActive('customer', item('customers')));
  assert.ok(isActive('design', item('designs')));
  assert.ok(!isActive('orders', item('customers')));
});
