/// <reference types="@cloudflare/workers-types" />
// Public order page API: view an order, upload a GCash receipt, find an order by reference + email, the GCash QR.
import { sha256 } from '../../../server/crypto';
import { notify } from '../../../server/order-emails';
import { verifyOrderView, signOrderView } from '../../../server/order-view';
import { expireIfOverdue, move } from '../../../server/orders';
import { loadPaymentSettings, paymentInstructions } from '../../../server/payments';
import { SECURITY_HEADERS } from '../../../server/security-headers';
import { turnstileError } from '../../../server/turnstile';
import { LIMITS } from '../../../shared/invitation-fields';
import { occasionOf } from '../../../shared/occasions';
import { CUSTOMER_MESSAGE, STATUS_LABEL, type OrderStatus } from '../../../shared/order-status';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  TURNSTILE_SECRET_KEY?: string;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const NOT_FOUND = () => json({ error: 'Order not found.' }, 404);
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const ORDER_SQL = 'SELECT o.*, i.slug, i.details, d.name AS design_name, d.product_type FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id WHERE o.reference = ?';
const RECEIPT_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  try {
    if (route === 'GET /api/orders/gcash-qr') {
      const key = (await loadPaymentSettings(env.DB)).qrKey;
      const obj = key && await env.PHOTOS.get(key);
      if (!obj) return json({ error: 'Not found.' }, 404);
      return new Response(obj.body, { headers: { ...SECURITY_HEADERS, 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' } });
    }
    if (route === 'POST /api/orders/lookup') return await lookup(request, env);

    const m = route.match(/^(GET|POST) \/api\/orders\/([^/]+)(\/receipt)?$/);
    if (!m || (m[1] === 'GET') === !!m[3]) return json({ error: 'Not found.' }, 404);
    const order = await authorized(request, env, decodeURIComponent(m[2]));
    if (!order) return NOT_FOUND();
    return m[3] ? await receipt(context, order) : await view(context, order);
  } catch (e) {
    console.error('orders API error:', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// X-Order-Token is the emailed tracking token or a lookup view token, and must belong to this reference.
async function authorized(request: Request, env: Env, reference: string): Promise<any | null> {
  const token = request.headers.get('X-Order-Token');
  if (!token) return null;
  const order = await env.DB.prepare(ORDER_SQL).bind(reference).first<any>();
  if (!order) return null;
  if (order.tracking_token_hash && order.tracking_token_hash === await sha256(token)) return order;
  if (env.JWT_SECRET && await verifyOrderView(token, env.JWT_SECRET, new Date()) === order.id) return order;
  return null;
}

async function view(context: EventContext<Env, any, any>, order: any): Promise<Response> {
  const { request, env } = context;
  if (await expireIfOverdue(env.DB, env.PHOTOS, { ...order, invitation_id: order.product_id }, new Date())) {
    context.waitUntil(notify(env.DB, request, order.id, 'cancelled'));
    order = await env.DB.prepare(ORDER_SQL).bind(order.reference).first<any>();
  }
  const status = order.status as OrderStatus;
  const { results: events } = await env.DB.prepare('SELECT at, kind, to_status, note FROM order_events WHERE order_id = ? AND visible = 1 ORDER BY at, id').bind(order.id).all<any>();
  const rejection = status === 'pending_payment'
    ? await env.DB.prepare("SELECT note FROM payments WHERE order_id = ? AND status = 'rejected' ORDER BY id DESC LIMIT 1").bind(order.id).first<any>()
    : null;
  return json({
    reference: order.reference, status, statusLabel: STATUS_LABEL[status] ?? status, message: CUSTOMER_MESSAGE[status] ?? '',
    title: occasionOf(order.product_type)?.title(parse(order.details, {})) ?? '', designName: order.design_name ?? '',
    amountCentavos: order.amount_centavos, deadline: order.payment_deadline, createdAt: order.created_at,
    events: (events || []).map((e) => ({ at: e.at, label: e.kind === 'status' ? STATUS_LABEL[e.to_status as OrderStatus] ?? e.to_status : 'Update', note: e.note })),
    payment: status === 'pending_payment'
      ? paymentInstructions(await loadPaymentSettings(env.DB), { reference: order.reference, amountCentavos: order.amount_centavos, paymentDeadline: order.payment_deadline })
      : null,
    lastRejection: rejection?.note ?? null,
    ...(status === 'delivered' && order.slug ? { guestUrl: `${new URL(request.url).origin}/i/${order.slug}` } : {}),
  });
}

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  webp: (b) => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
};

function receiptBytes(image: unknown): { type: string; bytes: Uint8Array } | string {
  const m = typeof image === 'string' ? RECEIPT_RE.exec(image) : null;
  if (!m) return 'The receipt must be a JPEG, PNG or WebP image.';
  // Checked before decoding so an oversized upload is not decoded at all
  if (m[2].length * 3 / 4 > LIMITS.receiptBytes + 2) return 'The receipt image is too large (max 5 MB).';
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > LIMITS.receiptBytes) return 'The receipt image is too large (max 5 MB).';
  if (!MAGIC[m[1]](bytes)) return 'The receipt must be a JPEG, PNG or WebP image.';
  return { type: m[1], bytes };
}

async function receipt(context: EventContext<Env, any, any>, order: any): Promise<Response> {
  const { request, env } = context;
  const now = new Date();
  if (order.status === 'payment_verification') return json({ error: 'We already have your receipt and are checking your payment.' }, 409);
  if (order.status !== 'pending_payment') return json({ error: 'This order is not waiting for payment.' }, 409);
  if (order.payment_deadline && Date.parse(order.payment_deadline) < now.getTime()) return json({ error: 'The payment deadline has passed.' }, 409);

  const body: any = await request.json().catch(() => ({}));
  const ref = body.customerReference ?? '';
  if (typeof ref !== 'string' || ref.trim().length > LIMITS.paymentRef) return json({ error: `The GCash reference number is too long (max ${LIMITS.paymentRef}).` }, 400);
  const img = receiptBytes(body.image);
  if (typeof img === 'string') return json({ error: img }, 400);

  const key = `receipts/${order.id}/${now.getTime()}.${img.type === 'jpeg' ? 'jpg' : img.type}`;
  await env.PHOTOS.put(key, img.bytes, { httpMetadata: { contentType: `image/${img.type}` } });
  const at = now.toISOString();
  let moved = false;
  try {
    // One transaction: the order moves only if still pending and before its deadline, and the payment row only if it moved
    const [upd] = await env.DB.batch([
      ...move(env.DB, order.id, 'pending_payment', 'payment_verification', { actor: 'customer', note: 'GCash receipt uploaded' }, at,
        ' AND (payment_deadline IS NULL OR payment_deadline >= ?5)', [at]),
      env.DB.prepare("INSERT INTO payments (order_id, provider, amount_centavos, status, customer_reference, receipt_key, submitted_at) SELECT ?, ?, ?, 'submitted', ?, ?, ? WHERE changes() = 1")
        .bind(order.id, order.provider, order.amount_centavos, ref.trim() || null, key, at),
    ]);
    moved = upd.meta.changes > 0;
  } finally {
    if (!moved) await env.PHOTOS.delete(key);
  }
  if (!moved) return json({ error: 'This order is no longer waiting for payment. Reload the page.' }, 409);
  context.waitUntil(notify(env.DB, request, order.id, 'receipt'));
  return json({ ok: true, status: 'payment_verification' });
}

async function lookup(request: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: 'Server misconfigured' }, 500);
  const body: any = await request.json().catch(() => ({}));
  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;
  const order = await env.DB.prepare('SELECT id, reference FROM orders WHERE reference = ? AND lower(customer_email) = ?')
    .bind(String(body.reference ?? '').trim().toUpperCase(), String(body.email ?? '').trim().toLowerCase()).first<any>();
  if (!order) return NOT_FOUND();
  return json({ reference: order.reference, viewToken: await signOrderView(order.id, env.JWT_SECRET, new Date()) });
}
