export const PAYMONGO_CHECKOUT_URL = 'https://api.paymongo.com/v1/checkout_sessions';

export async function createCheckoutSession(
  secretKey: string,
  o: {
    amountCentavos: number;
    itemName: string;
    referenceNumber: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail: string;
    metadata: Record<string, string>;
  },
): Promise<{ id: string; checkoutUrl: string }> {
  const res = await fetch(PAYMONGO_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(secretKey + ':')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ name: o.itemName, amount: o.amountCentavos, currency: 'PHP', quantity: 1 }],
          payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
          success_url: o.successUrl,
          cancel_url: o.cancelUrl,
          reference_number: o.referenceNumber,
          send_email_receipt: true,
          billing: { email: o.customerEmail },
          metadata: o.metadata,
        },
      },
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayMongo: ${json?.errors?.[0]?.detail ?? `request failed (${res.status})`}`);
  return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}

export async function verifyPaymongoSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  livemode: boolean,
  nowSec: number,
): Promise<boolean> {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const p of header.split(',')) {
    const i = p.indexOf('=');
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const t = Number(parts.t);
  const sig = livemode ? parts.li : parts.te;
  if (!parts.t || !Number.isFinite(t) || Math.abs(nowSec - t) > 300) return false;
  if (!sig || !/^[0-9a-f]+$/i.test(sig) || sig.length % 2) return false;
  const bytes = Uint8Array.from(sig.match(/../g)!, (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${parts.t}.${rawBody}`));
}
