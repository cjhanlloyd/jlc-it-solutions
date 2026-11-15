// Old admin URLs (invite/reset query links, #/admin and #/login hashes) map to the /admin portal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyAdminRedirect } from '../src/site/routes.ts';

const O = 'https://jlc.example';

test('invite and reset links move into the portal', () => {
  assert.equal(legacyAdminRedirect(`${O}/?inviteToken=t&email=a%40b.c`), '/admin#/invite?email=a%40b.c&token=t');
  assert.equal(legacyAdminRedirect(`${O}/?resetToken=r%2B1&email=a%40b.c`), '/admin#/reset?email=a%40b.c&token=r%2B1');
  assert.equal(legacyAdminRedirect(`${O}/?inviteToken=t`), '/admin#/invite?email=&token=t');
});

test('admin and login hashes go to /admin', () => {
  for (const h of ['#/admin', '#/login', '#/login/forgot-password']) assert.equal(legacyAdminRedirect(`${O}/${h}`), '/admin');
});

test('anything else is not a legacy admin URL', () => {
  for (const u of ['/designs', '/', '/#/services', '/#how', '/?utm_source=x']) assert.equal(legacyAdminRedirect(O + u), null);
});
