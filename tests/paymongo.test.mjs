import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createCheckoutSession, verifyPaymongoSignature, PAYMONGO_CHECKOUT_URL } from '../server/paymongo.ts';

const secret = 'whsec_x';
const body = '{"data":{"id":"evt_1"}}';
const now = 1700000000;
const sig = (t, b = body) => createHmac('sha256', secret).update(`${t}.${b}`).digest('hex');

test('te valid for test mode', async () => {
  assert.equal(await verifyPaymongoSignature(`t=${now},te=${sig(now)},li=`, body, secret, false, now), true);
});
test('li valid for live mode', async () => {
  assert.equal(await verifyPaymongoSignature(`t=${now},te=,li=${sig(now)}`, body, secret, true, now), true);
});
test('te rejected when livemode true', async () => {
  assert.equal(await verifyPaymongoSignature(`t=${now},te=${sig(now)},li=`, body, secret, true, now), false);
});
test('tampered body rejected', async () => {
  assert.equal(await verifyPaymongoSignature(`t=${now},te=${sig(now)},li=`, body + ' ', secret, false, now), false);
});
test('stale timestamp rejected', async () => {
  const t = now - 301;
  assert.equal(await verifyPaymongoSignature(`t=${t},te=${sig(t)},li=`, body, secret, false, now), false);
});
test('missing or malformed header rejected', async () => {
  assert.equal(await verifyPaymongoSignature(null, body, secret, false, now), false);
  assert.equal(await verifyPaymongoSignature('garbage', body, secret, false, now), false);
  assert.equal(await verifyPaymongoSignature(`t=${now}`, body, secret, false, now), false);
});

const opts = {
  amountCentavos: 99900, itemName: 'Invitation', referenceNumber: 'ref1',
  successUrl: 'https://x/s', cancelUrl: 'https://x/c', customerEmail: 'a@b.co', metadata: { k: 'v' },
};

test('createCheckoutSession sends auth + amount and parses response', async () => {
  const orig = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ data: { id: 'cs_1', attributes: { checkout_url: 'https://pay/cs_1' } } }), { status: 200 });
  };
  try {
    const r = await createCheckoutSession('sk_test_x', opts);
    assert.deepEqual(r, { id: 'cs_1', checkoutUrl: 'https://pay/cs_1' });
    assert.equal(call.url, PAYMONGO_CHECKOUT_URL);
    assert.equal(call.init.headers.Authorization, 'Basic ' + Buffer.from('sk_test_x:').toString('base64'));
    const a = JSON.parse(call.init.body).data.attributes;
    assert.equal(a.line_items[0].amount, 99900);
    assert.deepEqual(a.payment_method_types, ['qrph']);
    assert.equal(a.billing.email, 'a@b.co');
  } finally { globalThis.fetch = orig; }
});

test('createCheckoutSession throws PayMongo error on 400', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ errors: [{ detail: 'bad amount' }] }), { status: 400 });
  try {
    await assert.rejects(createCheckoutSession('sk_test_x', opts), /^Error: PayMongo: bad amount$/);
  } finally { globalThis.fetch = orig; }
});
