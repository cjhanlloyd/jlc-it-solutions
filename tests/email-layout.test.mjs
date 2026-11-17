// The shared email layout uses the site's palette, and the brand theme colour drives the accent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { buildHtmlEmail, getThemeColorHex } = await bundle('server/email.ts');
const branding = { companyName: 'JLC Solutions', tagline: 'Digital invitations', logoType: 'icon', themeColor: 'brand' };
const content = { contactEmail: 'hello@example.com' };

test('brand theme colour is the site green; existing choices keep their colours', () => {
  assert.equal(getThemeColorHex('brand'), '#1f3d2b');
  assert.equal(getThemeColorHex('deepblue'), '#2563eb');
  assert.equal(getThemeColorHex('slate'), '#475569');
});

test('email layout uses the site palette and the brand accent on the button', () => {
  const { html } = buildHtmlEmail(branding, content, 'Your invitation', 'Hello\n\nOpen it here: https://example.com/i/x');
  assert.match(html, /background-color: #fbf7f0/);
  assert.match(html, /Cormorant Garamond/);
  assert.match(html, /background-color: #1f3d2b/);
  assert.doesNotMatch(html, /#f1f5f9|#0f172a|Outfit/);
});
