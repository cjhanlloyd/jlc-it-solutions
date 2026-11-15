/// <reference types="@cloudflare/workers-types" />
// Admin customers: list with totals, detail with orders, payments, inquiries and activity, and contact edits.
import { verifyAdminToken } from '../../../../server/crypto';
import { sqlUtcToIso } from '../../../../server/orders';
import { can } from '../../../../server/permissions';
import { PAID_STATUSES } from '../../../../shared/order-status';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const NOT_FOUND = () => json({ error: 'Customer not found.' }, 404);
const PER_PAGE = 25;
const PAID = PAID_STATUSES.map((s) => `'${s}'`).join(', ');
const LIMITS = { name: 80, phone: 30, notes: 2000 } as const;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/customers/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'customers.view')) return json({ error: 'Your role cannot do this.' }, 403);
    const route = `${request.method} ${path}`;
    if (route === 'GET ') return await list(env, new URL(request.url).searchParams);
    const m = route.match(/^(GET|POST) \/([^/]+)$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    return m[1] === 'GET' ? await detail(env, m[2]) : await update(context, me, m[2]);
  } catch (e) {
    console.error('admin customers API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

const latest = (...ts: (string | null | undefined)[]) =>
  ts.map((t) => sqlUtcToIso(t ?? null)).filter((t): t is string => !!t).sort().pop() ?? null;

async function list(env: Env, params: URLSearchParams): Promise<Response> {
  const args: unknown[] = [];
  let filter = '';
  const q = params.get('q')?.trim();
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    filter = " WHERE (c.email LIKE ?1 ESCAPE '\\' OR c.name LIKE ?1 ESCAPE '\\')";
  }
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM customers c${filter}`).bind(...args).first<any>();
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.email, c.phone, c.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders,
      (SELECT COALESCE(SUM(o.amount_centavos), 0) FROM orders o WHERE o.customer_id = c.id AND o.status IN (${PAID})) AS paidCentavos,
      (SELECT MAX(COALESCE(o.updated_at, o.created_at)) FROM orders o WHERE o.customer_id = c.id) AS lastOrder,
      (SELECT MAX(i.createdAt) FROM inquiries i WHERE lower(i.email) = c.email) AS lastInquiry,
      (SELECT MAX(e.sentAt) FROM sent_emails e WHERE lower(e.to_address) = c.email) AS lastEmail
     FROM customers c${filter} ORDER BY c.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
  ).bind(...args).all<any>();
  const customers = (results || []).map((r) => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone, orders: r.orders, paidCentavos: r.paidCentavos,
    lastActivity: latest(r.lastOrder, r.lastInquiry, r.lastEmail),
  }));
  return json({ customers, page, pages });
}

async function detail(env: Env, id: string): Promise<Response> {
  const c = await env.DB.prepare('SELECT id, email, name, phone, notes, created_at FROM customers WHERE id = ?').bind(id).first<any>();
  if (!c) return NOT_FOUND();
  const [orders, payments, inquiries, events, emails] = await Promise.all([
    env.DB.prepare('SELECT id, reference, status, package_name, amount_centavos, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC').bind(id).all<any>(),
    env.DB.prepare('SELECT o.reference, p.status, p.amount_centavos, p.submitted_at FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.customer_id = ? ORDER BY p.id DESC').bind(id).all<any>(),
    env.DB.prepare('SELECT id, status, createdAt, serviceRequired FROM inquiries WHERE lower(email) = ? ORDER BY createdAt DESC').bind(c.email).all<any>(),
    env.DB.prepare('SELECT e.at, e.actor, e.kind, e.from_status, e.to_status, e.note, o.reference FROM order_events e JOIN orders o ON o.id = e.order_id WHERE o.customer_id = ?').bind(id).all<any>(),
    env.DB.prepare('SELECT id, subject, sentAt, email_type FROM sent_emails WHERE lower(to_address) = ?').bind(c.email).all<any>(),
  ]);
  const activity = [
    ...(events.results || []).map((e) => ({ type: 'order_event', at: sqlUtcToIso(e.at), orderReference: e.reference, actor: e.actor, kind: e.kind, from: e.from_status, to: e.to_status, note: e.note })),
    ...(inquiries.results || []).map((i) => ({ type: 'inquiry', at: sqlUtcToIso(i.createdAt), id: i.id, status: i.status, serviceRequired: i.serviceRequired })),
    ...(emails.results || []).map((m) => ({ type: 'email', at: sqlUtcToIso(m.sentAt), id: m.id, subject: m.subject, emailType: m.email_type })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 50);
  return json({
    customer: { ...c, created_at: sqlUtcToIso(c.created_at) },
    orders: (orders.results || []).map((o) => ({ id: o.id, reference: o.reference, status: o.status, packageName: o.package_name ?? 'Standard', amountCentavos: o.amount_centavos, createdAt: sqlUtcToIso(o.created_at) })),
    payments: (payments.results || []).map((p) => ({ orderReference: p.reference, status: p.status, amountCentavos: p.amount_centavos, submittedAt: sqlUtcToIso(p.submitted_at) })),
    inquiries: inquiries.results || [],
    activity,
  });
}

async function update(context: EventContext<Env, any, any>, me: Admin, id: string): Promise<Response> {
  const { request, env } = context;
  const b: any = (await request.json().catch(() => null)) ?? {};
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (b[k] === undefined) continue;
    const v = typeof b[k] === 'string' ? b[k].trim() : null;
    if (v === null || v.length > LIMITS[k]) return json({ error: `${k} must be text of up to ${LIMITS[k]} characters.` }, 400);
    if (k === 'name' && !v) return json({ error: "Name can't be empty." }, 400);
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return json({ error: 'Nothing to update.' }, 400);
  const res = await env.DB.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  if (!res.meta.changes) return NOT_FOUND();
  try {
    await env.DB.prepare('INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)').bind(new Date().toISOString(), 'customer', `${me.email} edited ${sets.map((s) => s.split(' ')[0]).join(', ')} on customer ${id}`).run();
  } catch (e) { console.error('audit log failed:', e); }
  return json({ ok: true });
}
