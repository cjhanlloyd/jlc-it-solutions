/// <reference types="@cloudflare/workers-types" />
// Admin orders: list, detail, receipt images and order actions. Every check is a role permission from server/permissions.
import { verifyAdminToken } from '../../../../server/crypto';
import { notify } from '../../../../server/order-emails';
import { addEvent, confirmPayment, deliver, refund, rejectPayment, sqlUtcToIso, transition, type Result } from '../../../../server/orders';
import { can, type Action } from '../../../../server/permissions';
import { SECURITY_HEADERS } from '../../../../server/security-headers';
import { LIMITS } from '../../../../shared/invitation-fields';
import { occasionOf } from '../../../../shared/occasions';
import { canTransition, PAID_STATUSES, STATUSES, STATUS_LABEL, type OrderStatus } from '../../../../shared/order-status';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string | null, fallback: unknown) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const FORBIDDEN = () => json({ error: 'Your role cannot do this.' }, 403);
const NOT_FOUND = () => json({ error: 'Order not found.' }, 404);
const PER_PAGE = 25;
const label = (s: string) => STATUS_LABEL[s as OrderStatus] ?? s;
const titleOf = (productType: string | null, details: string | null) => occasionOf(productType ?? '')?.title(parse(details, {})) ?? '';

// Targets of the `status` action and the permission each needs; other moves have their own action
const STATUS_ACTION: Partial<Record<OrderStatus, Action>> = {
  in_production: 'orders.work', for_review: 'orders.work', revision_requested: 'orders.work', completed: 'orders.work', cancelled: 'orders.refund',
};
// Permission behind every reachable next status, for allowedNext
const NEXT_ACTION: Record<OrderStatus, Action> = {
  ...STATUS_ACTION as Record<OrderStatus, Action>, pending_payment: 'payments.review', payment_verification: 'payments.review',
  payment_confirmed: 'payments.review', delivered: 'orders.work', refunded: 'orders.refund',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/orders/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'orders.view')) return FORBIDDEN();
    const route = `${request.method} ${path}`;
    if (route === 'GET ') return await list(env, me, new URL(request.url).searchParams);
    // Out-of-scope orders look exactly like unknown ones
    const id = path.match(/^\/(\d+)(\/|$)/)?.[1];
    if (id && me.role === 'Editor' && !await env.DB.prepare(`SELECT 1 FROM orders o WHERE o.id = ?1 AND ${editorScope('?2')}`).bind(Number(id), me.email).first()) return NOT_FOUND();
    const receiptM = route.match(/^GET \/(\d+)\/receipts\/(\d+)$/);
    if (receiptM) return can(me.role, 'payments.review') ? await receipt(env, Number(receiptM[1]), Number(receiptM[2])) : FORBIDDEN();
    const m = route.match(/^(GET|POST) \/(\d+)$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    return m[1] === 'GET' ? await detail(env, me, Number(m[2])) : await action(context, me, Number(m[2]));
  } catch (e) {
    console.error('admin orders API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// R7d: an Editor (Designer) sees orders assigned to them plus unassigned paid work; `p` is the placeholder for their email
const editorScope = (p: string) => `(o.assigned_to = ${p} OR (o.assigned_to IS NULL AND o.status IN (${PAID_STATUSES.map((s) => `'${s}'`).join(', ')})))`;
const FROM = 'FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id LEFT JOIN customers c ON c.id = o.customer_id';

async function list(env: Env, me: Admin, params: URLSearchParams): Promise<Response> {
  const contact = can(me.role, 'orders.contact');
  const where: string[] = [];
  const args: unknown[] = [];
  const q = params.get('q')?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    // Email is searchable only by roles that may see it; the title lives inside the details JSON
    where.push(`(o.reference LIKE ?1 ESCAPE '\\' OR c.name LIKE ?1 ESCAPE '\\' OR i.details LIKE ?1 ESCAPE '\\'${contact ? " OR o.customer_email LIKE ?1 ESCAPE '\\'" : ''})`);
    args.push(like);
  }
  const assigned = params.get('assigned');
  if (assigned === 'none') where.push('o.assigned_to IS NULL');
  else if (assigned) { where.push(`o.assigned_to = ?${args.length + 1}`); args.push(assigned === 'me' ? me.email : assigned); }
  if (me.role === 'Editor') { where.push(editorScope(`?${args.length + 1}`)); args.push(me.email); }
  const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const status = params.get('status');
  const byStatus = status ? `${filter ? `${filter} AND` : ' WHERE'} o.status = ?${args.length + 1}` : filter;
  const pageArgs = status ? [...args, status] : args;

  const [counts, total] = await Promise.all([
    env.DB.prepare(`SELECT o.status, COUNT(*) AS n ${FROM}${filter} GROUP BY o.status`).bind(...args).all<any>(),
    env.DB.prepare(`SELECT COUNT(*) AS n ${FROM}${byStatus}`).bind(...pageArgs).first<any>(),
  ]);
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.reference, o.status, o.customer_email, o.amount_centavos, o.created_at, o.assigned_to, i.details, d.product_type, d.name AS design_name, c.name AS customer_name ${FROM}${byStatus} ORDER BY o.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
  ).bind(...pageArgs).all<any>();

  const countMap = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of counts.results || []) if (r.status in countMap) countMap[r.status as OrderStatus] = r.n;
  return json({
    orders: (results || []).map((o) => ({
      id: o.id, reference: o.reference, status: o.status, statusLabel: label(o.status), title: titleOf(o.product_type, o.details),
      designName: o.design_name ?? '', customerName: o.customer_name ?? '', ...(contact ? { email: o.customer_email } : {}),
      amountCentavos: o.amount_centavos, createdAt: sqlUtcToIso(o.created_at), assignedTo: o.assigned_to,
      // No receipt yet (or a rejected one): the customer must upload
      awaitingReceipt: o.status === 'pending_payment',
    })),
    counts: countMap, page, pages,
  });
}

async function detail(env: Env, me: Admin, id: number): Promise<Response> {
  const o = await env.DB.prepare(
    `SELECT o.*, i.slug, i.status AS invitation_status, i.color_scheme, i.details, i.photos, d.layout_key, d.product_type AS design_type, d.name AS design_name, c.name AS customer_name, c.phone AS customer_phone ${FROM} WHERE o.id = ?`,
  ).bind(id).first<any>();
  if (!o) return NOT_FOUND();
  const [payments, events] = await Promise.all([
    env.DB.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').bind(id).all<any>(),
    env.DB.prepare('SELECT at, actor, kind, from_status, to_status, note, visible FROM order_events WHERE order_id = ? ORDER BY at, id').bind(id).all<any>(),
  ]);
  const review = can(me.role, 'payments.review');
  return json({
    order: {
      id: o.id, reference: o.reference, status: o.status, statusLabel: label(o.status), title: titleOf(o.design_type, o.details), designName: o.design_name ?? '',
      amountCentavos: o.amount_centavos, provider: o.provider, createdAt: sqlUtcToIso(o.created_at), updatedAt: sqlUtcToIso(o.updated_at), paymentDeadline: o.payment_deadline,
      deliveredAt: o.delivered_at, assignedTo: o.assigned_to,
    },
    customer: { name: o.customer_name ?? '', ...(can(me.role, 'orders.contact') ? { email: o.customer_email, phone: o.customer_phone ?? '' } : {}) },
    invitation: o.slug ? {
      slug: o.slug, status: o.invitation_status, layoutKey: o.layout_key, colorScheme: parse(o.color_scheme, {}), details: parse(o.details, {}), photos: parse(o.photos, []),
    } : null,
    payments: (payments.results || []).map((p) => ({
      id: p.id, status: p.status, amountCentavos: p.amount_centavos, customerReference: p.customer_reference, submittedAt: p.submitted_at,
      verifiedBy: p.verified_by, verifiedAt: p.verified_at, adminReference: p.admin_reference, note: p.note,
      ...(review && p.receipt_key ? { receiptUrl: `/api/admin/orders/${id}/receipts/${p.id}` } : {}),
    })),
    events: (events.results || []).map((e) => ({ at: e.at, actor: e.actor, kind: e.kind, from: e.from_status, to: e.to_status, note: e.note, visible: !!e.visible })),
    allowedNext: STATUSES.filter((s) => canTransition(o.status, s) && can(me.role, NEXT_ACTION[s])),
  });
}

async function receipt(env: Env, orderId: number, paymentId: number): Promise<Response> {
  const p = await env.DB.prepare('SELECT receipt_key FROM payments WHERE id = ? AND order_id = ?').bind(paymentId, orderId).first<any>();
  const obj = p?.receipt_key && await env.PHOTOS.get(p.receipt_key);
  if (!obj) return json({ error: 'Receipt not found.' }, 404);
  return new Response(obj.body, { headers: { ...SECURITY_HEADERS, 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store' } });
}

const REQUIRES: Record<string, Action> = {
  approve: 'payments.review', reject: 'payments.review', deliver: 'orders.work', refund: 'orders.refund',
  assign: 'orders.assign', note: 'orders.work', resend: 'orders.contact',
};
const fail = (r: Result, status = 409) => json({ error: 'error' in r ? r.error : 'Something went wrong.' }, status);
// Own keys only, so 'constructor' and friends are unknown
const own = <T,>(o: Record<string, T>, k: unknown): T | undefined => (typeof k === 'string' && Object.hasOwn(o, k) ? o[k] : undefined);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function action(context: EventContext<Env, any, any>, me: Admin, id: number): Promise<Response> {
  const { request, env } = context;
  const b: any = await request.json().catch(() => ({}));
  const kind = String(b.action ?? '');
  const need = kind === 'status' ? own(STATUS_ACTION, b.to) : own(REQUIRES, kind);
  if (!need) return json({ error: kind === 'status' ? 'That status cannot be set directly.' : 'Unknown action.' }, 400);
  if (!can(me.role, need)) return FORBIDDEN();
  const order = await env.DB.prepare('SELECT id, reference, status FROM orders WHERE id = ?').bind(id).first<any>();
  if (!order) return NOT_FOUND();
  const actor = me.email;
  const later = (k: Parameters<typeof notify>[3], extra?: Parameters<typeof notify>[4]) => context.waitUntil(notify(env.DB, request, id, k, extra));
  const audit = (what: string) => env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'order', ?)")
    .bind(new Date().toISOString(), `${actor} ${what} on order ${order.reference}`).run();
  // The payment must belong to this order
  const paymentOf = async () => Number.isInteger(b.paymentId)
    && !!await env.DB.prepare('SELECT 1 FROM payments WHERE id = ? AND order_id = ?').bind(b.paymentId, id).first();

  switch (kind) {
    case 'approve': {
      const ref = b.adminReference == null ? '' : text(b.adminReference);
      if (typeof (b.adminReference ?? '') !== 'string' || ref.length > LIMITS.paymentRef) return json({ error: `The reference is too long (max ${LIMITS.paymentRef}).` }, 400);
      if (!await paymentOf()) return json({ error: 'Payment not found.' }, 404);
      const r = await confirmPayment(env.DB, b.paymentId, { actor, adminReference: ref || undefined });
      if (!r.ok) return fail(r);
      await audit(`approve payment ${b.paymentId}`);
      later('confirmed');
      return json({ ok: true });
    }
    case 'reject': {
      const reason = text(b.reason);
      if (!reason || reason.length > LIMITS.rejectReason) return json({ error: `A reason of up to ${LIMITS.rejectReason} characters is required.` }, 400);
      if (!await paymentOf()) return json({ error: 'Payment not found.' }, 404);
      const r = await rejectPayment(env.DB, b.paymentId, { actor, reason });
      if (!r.ok) return fail(r);
      await audit(`reject payment ${b.paymentId}`);
      later('rejected', { reason });
      return json({ ok: true });
    }
    case 'status': {
      const note = text(b.note);
      if (note.length > 1000) return json({ error: 'The note is too long (max 1000).' }, 400);
      if (!canTransition(order.status, b.to)) return json({ error: `An order in ${label(order.status)} cannot move to ${label(b.to)}.` }, 400);
      const r = await transition(env.DB, id, b.to, { actor, note: note || undefined });
      if (!r.ok) return fail(r);
      await audit(`status ${order.status} -> ${b.to}`);
      if (b.to === 'cancelled') later('cancelled');
      return json({ ok: true });
    }
    case 'deliver': {
      const r = await deliver(env.DB, id, { actor });
      if (!r.ok) return fail(r);
      await audit('deliver');
      const smtp = await env.DB.prepare("SELECT enabled FROM smtp_settings WHERE id = 'default'").first<any>();
      later('delivered');
      return json({ ok: true, emailed: !!smtp?.enabled });
    }
    case 'refund': {
      const note = text(b.note);
      if (note.length > 1000) return json({ error: 'The note is too long (max 1000).' }, 400);
      const r = await refund(env.DB, env.PHOTOS, id, { actor, note: note || undefined });
      if (!r.ok) return fail(r);
      await audit('refund');
      later('refunded');
      return json({ ok: true });
    }
    case 'assign': {
      const admin = b.email === null ? null
        : await env.DB.prepare("SELECT email FROM admins WHERE lower(email) = ? AND status = 'Active'").bind(text(b.email).toLowerCase()).first<any>();
      if (b.email !== null && !admin) return json({ error: 'Assign to an active admin.' }, 400);
      const email: string | null = admin?.email ?? null;
      await env.DB.prepare('UPDATE orders SET assigned_to = ?, updated_at = ? WHERE id = ?').bind(email, new Date().toISOString(), id).run();
      await addEvent(env.DB, id, { actor, kind: 'assign', note: email ? `Assigned to ${email}` : 'Unassigned' });
      await audit(email ? `assign to ${email}` : 'unassign');
      return json({ ok: true });
    }
    case 'note': {
      const body = text(b.body);
      if (!body || body.length > 1000) return json({ error: 'A note of up to 1000 characters is required.' }, 400);
      await addEvent(env.DB, id, { actor, kind: 'note', note: body });
      await audit('note');
      return json({ ok: true });
    }
    case 'resend': {
      if (order.status !== 'delivered') return json({ error: 'Only a delivered order can be resent.' }, 409);
      const smtp = await env.DB.prepare("SELECT enabled FROM smtp_settings WHERE id = 'default'").first<any>();
      if (!smtp?.enabled) return json({ error: 'Email is not configured; enable SMTP first.' }, 409);
      await audit('resend');
      later('delivered');
      return json({ ok: true });
    }
  }
  return json({ error: 'Unknown action.' }, 400);
}
