// Hash routing for the public site: the shop is the default, old IT tab links keep working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tabFromHash } from '../src/site-tabs.ts';

test('empty hash and unknown routes open the shop', () => {
  for (const h of ['', '#', '#/', '#/nonsense']) assert.equal(tabFromHash(h), 'shop');
});
test('old IT tab links keep working', () => {
  for (const t of ['home', 'about', 'services', 'pricing', 'why', 'contact', 'inquiry', 'admin']) assert.equal(tabFromHash(`#/${t}`), t);
  assert.equal(tabFromHash('#/services?x=1'), 'services');
});
test('login routes are left to the modal', () => {
  assert.equal(tabFromHash('#/login'), null);
  assert.equal(tabFromHash('#/login/forgot-password'), null);
});
