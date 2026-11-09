/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from '../../../server/crypto';
import { EMAIL_RE } from '../../../server/email';
import { createCheckoutSession } from '../../../server/paymongo';
import { LIMITS, makeSlug, validateDetails } from '../../../shared/invitation-fields';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  TURNSTILE_SECRET_KEY?: string;
  PAYMONGO_SECRET_KEY?: string;
  PAYMONGO_WEBHOOK_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  try {
    if (route === 'GET /api/invitations/designs') {
      const { results } = await env.DB.prepare(
        'SELECT slug, name, layout_key, price_centavos, color_schemes, preview_images, sample_details FROM products_designs WHERE active = 1 ORDER BY sort_order, id',
      ).all<any>();
      return json({ designs: (results || []).map((d) => ({
        slug: d.slug, name: d.name, layoutKey: d.layout_key, priceCentavos: d.price_centavos,
        colorSchemes: parse(d.color_schemes, []), previewImages: parse(d.preview_images, []), sampleDetails: parse(d.sample_details, {}),
      })) });
    }

    if (route === 'GET /api/invitations/order-status') {
      const order = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(url.searchParams.get('order') ?? '').first<any>();
      return order ? json({ status: order.status }) : json({ error: 'Order not found.' }, 404);
    }

    if (route === 'POST /api/invitations/checkout') return await checkout(request, env, url.origin);

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('invitations API error:', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function checkout(request: Request, env: Env, origin: string): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  if (!env.TURNSTILE_SECRET_KEY || !env.PAYMONGO_SECRET_KEY) return json({ error: 'Server misconfigured: payment keys are not set.' }, 500);
  if (typeof body.turnstileToken !== 'string' || !body.turnstileToken) return json({ error: 'Please complete the anti-spam check.' }, 400);
  const verification: any = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken, remoteip: request.headers.get('CF-Connecting-IP') || '127.0.0.1' }),
  })).json();
  if (!verification.success) return json({ error: 'The anti-spam check failed. Please try again.' }, 400);

  if (body.termsAccepted !== true) return json({ error: 'Please accept the terms to continue.' }, 400);

  const design = await env.DB.prepare('SELECT * FROM products_designs WHERE slug = ? AND active = 1').bind(String(body.designSlug ?? '')).first<any>();
  if (!design) return json({ error: 'That design is not available.' }, 400);

  const scheme = (parse(design.color_schemes, []) as any[]).find((s) => s && s.name === body.colorScheme);
  if (!scheme) return json({ error: 'Please choose one of the design\'s color schemes.' }, 400);

  const v = validateDetails(body.details);
  if (v.ok === false) return json({ error: v.error }, 400);
  const details = v.details;

  const photos: unknown = body.photos ?? [];
  if (!Array.isArray(photos)) return json({ error: 'Photos must be a list.' }, 400);
  if (photos.length > LIMITS.photos) return json({ error: `Too many photos (max ${LIMITS.photos}).` }, 400);
  for (const p of photos) {
    if (typeof p !== 'string' || !PHOTO_RE.test(p)) return json({ error: 'Photos must be JPEG, PNG or WebP images.' }, 400);
    if (p.length > LIMITS.photoChars) return json({ error: 'A photo is too large.' }, 400);
  }

  const token = randomToken();
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join('');
  // Rows first, so the R2 keys can use the real invitation id
  const inv = await env.DB.prepare(
    "INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash) VALUES (?, ?, ?, ?, '[]', 'pending', ?, ?)",
  ).bind(design.id, makeSlug(details.partner1, details.partner2, suffix), JSON.stringify(scheme), JSON.stringify(details), details.eventDate, await sha256(token)).run();
  const invitationId = inv.meta.last_row_id;
  const ord = await env.DB.prepare(
    "INSERT INTO orders (product_id, customer_email, amount_centavos, status, terms_accepted_at) VALUES (?, ?, ?, 'pending', ?)",
  ).bind(invitationId, email, design.price_centavos, new Date().toISOString()).run();
  const orderId = ord.meta.last_row_id;

  const keys: string[] = [];
  try {
    for (const [n, p] of (photos as string[]).entries()) {
      const [, type] = p.match(PHOTO_RE)!;
      const key = `inv/${invitationId}/${n}.${type === 'jpeg' ? 'jpg' : type}`;
      const bin = atob(p.slice(p.indexOf(',') + 1));
      await env.PHOTOS.put(key, Uint8Array.from(bin, (c) => c.charCodeAt(0)), { httpMetadata: { contentType: `image/${type}` } });
      keys.push(key);
    }
    await env.DB.prepare('UPDATE invitations SET photos = ? WHERE id = ?').bind(JSON.stringify(keys), invitationId).run();

    const session = await createCheckoutSession(env.PAYMONGO_SECRET_KEY, {
      amountCentavos: design.price_centavos,
      itemName: `Wedding invitation: ${design.name}`,
      referenceNumber: String(orderId),
      successUrl: `${origin}/invitations/success#${orderId}.${token}`,
      cancelUrl: `${origin}/invitations/${design.slug}`,
      customerEmail: email,
      metadata: { order_id: String(orderId) },
    });
    await env.DB.prepare('UPDATE orders SET paymongo_checkout_id = ? WHERE id = ?').bind(session.id, orderId).run();
    return json({ checkoutUrl: session.checkoutUrl });
  } catch (e) {
    console.error('checkout failed:', e instanceof Error ? e.message : e);
    if (keys.length) await env.PHOTOS.delete(keys);
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run();
    await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();
    return json({ error: 'We could not start the payment. Please try again in a moment.' }, 502);
  }
}
