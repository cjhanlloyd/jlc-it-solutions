// public/gtag.js: consent defaults to denied, follows a stored choice, and the tag never loads on private-code pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SECURITY_HEADERS } from '../server/security-headers.ts';

const src = readFileSync(new URL('../public/gtag.js', import.meta.url), 'utf8');

function run(pathname, stored) {
  const added = [];
  const window = {
    location: { pathname },
    localStorage: { getItem: () => stored },
    document: { createElement: () => ({}), head: { appendChild: (el) => added.push(el.src) } },
  };
  vm.runInNewContext(src, { window, Date });
  const consent = window.dataLayer.find((a) => a[0] === 'consent')[2];
  return { added, consent };
}

test('no stored choice: analytics denied, tag loaded on public pages', () => {
  const r = run('/designs', null);
  assert.equal(r.consent.analytics_storage, 'denied');
  assert.equal(r.consent.ad_storage, 'denied');
  assert.deepEqual(r.added, ['https://www.googletagmanager.com/gtm.js?id=GTM-5NWDCP52']);
});

test('stored consent grants analytics only', () => {
  const r = run('/', 'granted');
  assert.equal(r.consent.analytics_storage, 'granted');
  assert.equal(r.consent.ad_user_data, 'denied');
});

test('private-code pages never load the tag', () => {
  for (const p of ['/checkin', '/c/abc123', '/manage', '/order/JLC-ABC123']) assert.deepEqual(run(p, 'granted').added, [], p);
});

test('the CSP allows Google Tag Manager and analytics endpoints', () => {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
});
