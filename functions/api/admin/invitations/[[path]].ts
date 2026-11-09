/// <reference types="@cloudflare/workers-types" />
import { verifyAdminToken } from '../../../../server/crypto';
import { emailAndRotateToken } from '../../../../server/invitation-links';
import { LAYOUT_KEYS, validateDetails } from '../../../../shared/invitation-fields';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const WRITERS = ['Super Admin', 'Administrator'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/invitations/, '');
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (request.method === 'POST' && !WRITERS.includes(me.role)) return json({ error: 'Your role cannot make changes.' }, 403);

    const route = `${request.method} ${path}`;
    if (route === 'GET /overview') return await overview(env);
    const rsvpsId = route.match(/^GET \/invitations\/(\d+)\/rsvps$/)?.[1];
    if (rsvpsId) return await rsvps(env, Number(rsvpsId));

    if (request.method === 'POST' && ['/designs', '/orders/refund', '/orders/resend'].includes(path)) {
      const body: any = await request.json().catch(() => ({}));
      if (path === '/designs') return await designAction(env, body);
      return path === '/orders/refund' ? await refund(env, me.email, body.orderId) : await resend(request, env, body.orderId, url.origin);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin invitations API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function overview(env: Env): Promise<Response> {
  const [designs, orders, events, invitations, totals] = await Promise.all([
    env.DB.prepare('SELECT * FROM products_designs ORDER BY sort_order, id').all<any>(),
    env.DB.prepare(
      'SELECT o.id, o.customer_email, o.amount_centavos, o.status, o.created_at, o.paid_at, o.product_id AS invitation_id, i.slug, d.name AS design_name FROM orders o JOIN invitations i ON i.id = o.product_id JOIN products_designs d ON d.id = i.design_id ORDER BY o.id DESC',
    ).all<any>(),
    // Type and time only: the raw payload stays out of the response
    env.DB.prepare('SELECT order_id, type, received_at FROM payment_events WHERE order_id IS NOT NULL ORDER BY received_at, rowid').all<any>(),
    env.DB.prepare(
      'SELECT i.id, i.slug, i.status, i.event_date, i.created_at, d.name AS design_name, (SELECT COUNT(*) FROM rsvps r WHERE r.invitation_id = i.id) AS rsvpCount FROM invitations i JOIN products_designs d ON d.id = i.design_id ORDER BY i.id DESC',
    ).all<any>(),
    env.DB.prepare("SELECT COUNT(*) AS paidCount, COALESCE(SUM(amount_centavos), 0) AS paidCentavos FROM orders WHERE status = 'paid'").first<any>(),
  ]);
  const trail = new Map<number, { type: string; received_at: string }[]>();
  for (const e of events.results || []) trail.set(e.order_id, [...(trail.get(e.order_id) || []), { type: e.type, received_at: e.received_at }]);
  return json({
    designs: (designs.results || []).map((d) => ({
      ...d, active: !!d.active, color_schemes: parse(d.color_schemes, []), preview_images: parse(d.preview_images, []), sample_details: parse(d.sample_details, {}),
    })),
    orders: (orders.results || []).map((o) => ({ ...o, payment_events: trail.get(o.id) || [] })),
    invitations: invitations.results || [],
    totals: { paidCount: totals?.paidCount ?? 0, paidCentavos: totals?.paidCentavos ?? 0 },
  });
}

async function rsvps(env: Env, id: number): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT guest_name, attending, party_size, message, created_at FROM rsvps WHERE invitation_id = ? ORDER BY created_at, id',
  ).bind(id).all<any>();
  return json({ rsvps: (results || []).map((r) => ({ guestName: r.guest_name, attending: !!r.attending, partySize: r.party_size, message: r.message ?? '', submitted: r.created_at })) });
}

// Returns the cleaned design, or an error message.
function validateDesign(b: any): { ok: true; d: any } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 80) return bad('Name must be 1 to 80 characters.');
  if (typeof b.slug !== 'string' || b.slug.length > 60 || !SLUG_RE.test(b.slug)) return bad('Slug must be lowercase letters, numbers and single hyphens (max 60).');
  if (!(LAYOUT_KEYS as readonly string[]).includes(b.layout_key)) return bad('Unknown layout.');
  if (!Number.isInteger(b.price_centavos) || b.price_centavos < 1000 || b.price_centavos > 10_000_000) return bad('Price must be a whole number of centavos from 1,000 to 10,000,000.');
  const schemes = b.color_schemes;
  const schemeOk = (s: any) => s && typeof s.name === 'string' && s.name.trim() && ['primary', 'accent', 'background', 'text'].every((k) => typeof s[k] === 'string' && HEX_RE.test(s[k]));
  if (!Array.isArray(schemes) || !schemes.length || !schemes.every(schemeOk)) return bad('Color schemes need a name and #rrggbb primary, accent, background and text.');
  const imgs = b.preview_images;
  if (!Array.isArray(imgs) || !imgs.every((u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u))) return bad('Preview images must be a list of https URLs.');
  const v = validateDetails(b.sample_details);
  if (v.ok === false) return bad(`Sample details: ${v.error}`);
  return { ok: true, d: {
    slug: b.slug, name, layout_key: b.layout_key, price_centavos: b.price_centavos,
    color_schemes: JSON.stringify(schemes.map((s: any) => ({ name: s.name.trim(), primary: s.primary, accent: s.accent, background: s.background, text: s.text }))),
    preview_images: JSON.stringify(imgs), sample_details: JSON.stringify(v.details), active: b.active === false ? 0 : 1,
  } };
}

const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const SLUG_TAKEN = () => json({ error: 'That slug is already used by another design.' }, 409);

async function designAction(env: Env, b: any): Promise<Response> {
  if (b.action === 'toggle') {
    if (!isId(b.id) || typeof b.active !== 'boolean') return json({ error: 'A design id and active flag are required.' }, 400);
    const r = await env.DB.prepare('UPDATE products_designs SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, b.id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Design not found.' }, 404);
  }
  if (b.action === 'reorder') {
    if (!Array.isArray(b.ids) || !b.ids.length || !b.ids.every(isId) || new Set(b.ids).size !== b.ids.length) return json({ error: 'ids must be a list of distinct design ids.' }, 400);
    await env.DB.batch((b.ids as number[]).map((id, i) => env.DB.prepare('UPDATE products_designs SET sort_order = ? WHERE id = ?').bind(i + 1, id)));
    return json({ ok: true });
  }
  if (b.action !== 'add' && b.action !== 'update') return json({ error: 'Unknown action.' }, 400);
  if (b.action === 'update' && !isId(b.id)) return json({ error: 'A design id is required.' }, 400);
  const v = validateDesign(b);
  if (v.ok === false) return json({ error: v.error }, 400);
  const d = v.d;
  const taken = b.action === 'add'
    ? await env.DB.prepare('SELECT id FROM products_designs WHERE slug = ?').bind(d.slug).first()
    : await env.DB.prepare('SELECT id FROM products_designs WHERE slug = ? AND id != ?').bind(d.slug, b.id).first();
  if (taken) return SLUG_TAKEN();
  const fields = [d.slug, d.name, d.layout_key, d.price_centavos, d.color_schemes, d.preview_images, d.sample_details, d.active];
  try {
    if (b.action === 'add') {
      await env.DB.prepare(
        'INSERT INTO products_designs (slug, name, layout_key, price_centavos, color_schemes, preview_images, sample_details, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM products_designs))',
      ).bind(...fields).run();
      return json({ ok: true });
    }
    // Live invitations read layout_key from their design, so it is fixed for life; other edits do not reach them (they keep their own scheme copy)
    const stored = await env.DB.prepare('SELECT layout_key FROM products_designs WHERE id = ?').bind(b.id).first<any>();
    if (!stored) return json({ error: 'Design not found.' }, 404);
    if (stored.layout_key !== d.layout_key) return json({ error: "A design's layout can't be changed; add a new design instead." }, 409);
    const [slug, name, , price, schemes, imgs, sample, active] = fields;
    const r = await env.DB.prepare(
      'UPDATE products_designs SET slug = ?, name = ?, price_centavos = ?, color_schemes = ?, preview_images = ?, sample_details = ?, active = ? WHERE id = ?',
    ).bind(slug, name, price, schemes, imgs, sample, active, b.id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Design not found.' }, 404);
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) return SLUG_TAKEN(); // lost a race with another admin
    throw e;
  }
}

const ORDER_SQL = 'SELECT o.id, o.status, o.customer_email, o.product_id, i.slug, i.status AS invitation_status FROM orders o JOIN invitations i ON i.id = o.product_id WHERE o.id = ?';

// Marks the order and its invitation refunded. The money itself is refunded in the PayMongo dashboard.
async function refund(env: Env, adminEmail: string, orderId: unknown): Promise<Response> {
  if (!isId(orderId)) return json({ error: 'An order id is required.' }, 400);
  const order = await env.DB.prepare(ORDER_SQL).bind(orderId).first<any>();
  if (!order) return json({ error: 'Order not found.' }, 404);
  if (order.status !== 'paid') return json({ error: 'Only a paid order can be refunded.' }, 409);
  const [flipped] = await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status = 'refunded' WHERE id = ? AND status = 'paid'").bind(orderId),
    env.DB.prepare("UPDATE invitations SET status = 'refunded' WHERE id = ?").bind(order.product_id),
    env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)")
      .bind(new Date().toISOString(), `${adminEmail} refunded order ${orderId} (${order.customer_email})`),
  ]);
  return flipped.meta.changes ? json({ ok: true }) : json({ error: 'Only a paid order can be refunded.' }, 409);
}

async function resend(request: Request, env: Env, orderId: unknown, origin: string): Promise<Response> {
  if (!isId(orderId)) return json({ error: 'An order id is required.' }, 400);
  const order = await env.DB.prepare(ORDER_SQL).bind(orderId).first<any>();
  if (!order) return json({ error: 'Order not found.' }, 404);
  if (order.status !== 'paid' || order.invitation_status !== 'live') return json({ error: 'Only a paid, live invitation can be resent.' }, 409);
  const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
  if (!smtp?.enabled) return json({ error: 'Email is not configured; enable SMTP first.' }, 409);
  try {
    await emailAndRotateToken(env.DB, smtp, request, order.product_id, (token) => ({
      to: order.customer_email,
      subject: 'Your wedding invitation links',
      // "Key: value" lines: the HTML builder keeps every URL there (plain paragraphs keep only the first)
      body: [
        'Here are the links to your wedding invitation. Share the guest link with your guests. Use the manage link to edit your invitation and see RSVPs, and keep it private. Any earlier manage link no longer works.',
        '',
        `Guest link: ${origin}/i/${order.slug}`,
        `Manage link: ${origin}/manage#${token}`,
      ].join('\n'),
    }));
  } catch (e) {
    console.error('Admin resend failed:', e instanceof Error ? e.message : e);
    return json({ error: 'The email could not be sent. The previous links still work.' }, 502);
  }
  return json({ ok: true });
}
