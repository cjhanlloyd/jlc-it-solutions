// New-order alert: one email to the team per order, never breaks checkout.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: invitations } = await bundle('functions/api/invitations/[[path]].ts');

globalThis.fetch = async (url, init) => {
  if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true });
  throw new Error('Unexpected fetch ' + url);
};

let db, r2, background;
beforeEach(() => {
  db = makeD1(); r2 = makeR2(); background = []; globalThis.SMTP_SENT = []; globalThis.SMTP_FAIL = false;
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation');
    INSERT INTO smtp_settings (id, host, port, senderName, senderEmail, enabled) VALUES ('default', 'h', 587, 'JLC', 'co@x.com', 1);
    UPDATE payment_settings SET gcash_account_name = 'JLC', gcash_number = '09171234567', qr_key = 'settings/qr.png'`);
  r2.map.set('settings/qr.png', { body: 'qr', bytes: new Uint8Array([1]), httpMetadata: { contentType: 'image/png' } });
});
const place = async () => {
  const res = await invitations({
    request: new Request('https://shop.test/api/invitations/checkout', { method: 'POST', body: JSON.stringify({
      designSlug: 'classic-elegance', colorScheme: 'Blush', email: 'bride@example.com', name: 'Maria Cruz', phone: '0917', termsAccepted: true,
      turnstileToken: 'x', details: { partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', ceremony: { name: 'St. Joseph' } } }) }),
    env: { DB: db, PHOTOS: r2, TURNSTILE_SECRET_KEY: 's', JWT_SECRET: 'j' }, waitUntil(p) { background.push(p); },
  });
  await Promise.all(background);
  return res;
};
const mails = () => globalThis.SMTP_SENT.filter((t) => t.startsWith('Message-ID')).map((t) => t.replace(/=\r\n/g, ''));
const toLines = (m) => m.match(/^To: .*$/m)?.[0];

test('one alert per order to the configured address, with the key lines and admin link', async () => {
  db.exec.exec("UPDATE smtp_settings SET order_alert_email = '  alerts@x.com '");
  const { reference } = await (await place()).json();
  const all = mails();
  assert.equal(all.length, 2);
  const alerts = all.filter((m) => m.includes('New order'));
  assert.equal(alerts.length, 1);
  assert.match(toLines(alerts[0]), /alerts@x\.com/);
  assert.match(alerts[0], new RegExp(`Subject: New order ${reference}`));
  for (const s of ['Maria Cruz', 'bride@example.com', 'Classic Elegance', 'Awaiting payment', 'PHP 999.00', '/admin#/orders/']) assert.ok(alerts[0].includes(s), s);
  assert.ok(!/Promo code/.test(alerts[0]));
  const placed = all.find((m) => m.includes('Your order is placed'));
  assert.match(toLines(placed), /bride@example\.com/);
});

test('falls back to the sender address when no alert address is set', async () => {
  await place();
  assert.match(toLines(mails().find((m) => m.includes('New order'))), /co@x\.com/);
});

test('an SMTP failure still returns the checkout 200 and logs the alert failure', async () => {
  globalThis.SMTP_FAIL = true;
  const logged = [];
  const orig = console.error; console.error = (...a) => logged.push(a.join(' '));
  try { assert.equal((await place()).status, 200); } finally { console.error = orig; }
  assert.ok(logged.some((l) => /New-order alert for order \d+ failed/.test(l)), logged.join('|'));
});
