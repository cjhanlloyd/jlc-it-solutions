/// <reference types="@cloudflare/workers-types" />
// Admin inquiries: list, detail, attachment download and actions (status, notes, reply, order link, delete).
import { verifyAdminToken } from '../../../../server/crypto';
import { sendSmtpEmail } from '../../../../server/email';
import { can } from '../../../../server/permissions';
import { SECURITY_HEADERS } from '../../../../server/security-headers';
import { validatePackages } from '../../../../shared/packages';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string | null, fallback: unknown) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const NOT_FOUND = () => json({ error: 'Inquiry not found.' }, 404);
const PER_PAGE = 25;
const STATUSES = ['New', 'In Progress', 'Replied', 'Converted', 'Closed'];
const CUSTOM_PREFIX = 'Custom package request:';
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const SMTP_OFF = () => json({ error: 'SMTP is disabled or not configured. Cannot send replies.' }, 400);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/inquiries/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'inquiries.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    const route = `${request.method} ${path}`;
    if (route === 'GET ') return await list(env, new URL(request.url).searchParams);
    const att = route.match(/^GET \/([^/]+)\/attachment$/);
    if (att) return await attachment(env, att[1]);
    const m = route.match(/^(GET|POST) \/([^/]+)$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    return m[1] === 'GET' ? await detail(env, m[2]) : await action(context, me, m[2]);
  } catch (e) {
    console.error('admin inquiries API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// The attachment is a JSON string holding a base64 body (data URL or bare); the body never leaves the server except via /attachment
function decodeAttachment(raw: string | null): { name: string; type: string; bytes: Uint8Array } | null {
  const a = parse(raw, null);
  if (!a || typeof a.base64 !== 'string') return null;
  try {
    const bin = atob(a.base64.replace(/^data:[^,]*,/, ''));
    return { name: String(a.name ?? 'attachment'), type: String(a.type ?? ''), bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)) };
  } catch { return null; }
}
const attachmentMeta = (raw: string | null) => {
  const a = decodeAttachment(raw);
  return a ? { name: a.name, type: a.type, size: a.bytes.length } : null;
};

async function list(env: Env, params: URLSearchParams): Promise<Response> {
  const args: unknown[] = [];
  let filter = '';
  const q = params.get('q')?.trim();
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    filter = " WHERE (fullName LIKE ?1 ESCAPE '\\' OR email LIKE ?1 ESCAPE '\\' OR companyName LIKE ?1 ESCAPE '\\' OR serviceRequired LIKE ?1 ESCAPE '\\')";
  }
  const status = params.get('status');
  const byStatus = status ? `${filter ? `${filter} AND` : ' WHERE'} status = ?${args.length + 1}` : filter;
  const pageArgs = status ? [...args, status] : args;
  const [counts, total] = await Promise.all([
    env.DB.prepare(`SELECT status, COUNT(*) AS n FROM inquiries${filter} GROUP BY status`).bind(...args).all<any>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM inquiries${byStatus}`).bind(...pageArgs).first<any>(),
  ]);
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const { results } = await env.DB.prepare(
    `SELECT id, fullName, companyName, email, phone, serviceRequired, status, createdAt, substr(projectDescription, 1, length(?${pageArgs.length + 1})) = ?${pageArgs.length + 1} AS isCustomRequest FROM inquiries${byStatus} ORDER BY createdAt DESC, id LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
  ).bind(...pageArgs, CUSTOM_PREFIX).all<any>();
  const countMap: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  // Unknown legacy statuses are counted under their own name
  for (const r of counts.results || []) countMap[r.status] = r.n;
  return json({ inquiries: (results || []).map((r) => ({ ...r, isCustomRequest: !!r.isCustomRequest })), counts: countMap, page, pages });
}

// Same email, same customer: created on first view or action, never overwritten
async function customerId(env: Env, i: { email: string; fullName: string; phone: string }): Promise<number> {
  const email = i.email.trim().toLowerCase();
  await env.DB.prepare('INSERT INTO customers (email, name, phone) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING').bind(email, i.fullName, i.phone).run();
  return (await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<any>())!.id;
}

async function detail(env: Env, id: string): Promise<Response> {
  const i = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<any>();
  if (!i) return NOT_FOUND();
  const { fileAttachment, ipAddress, ...rest } = i;
  const emails = await env.DB.prepare('SELECT id, to_address, subject, body, sentAt, email_type FROM sent_emails WHERE inquiryId = ? ORDER BY sentAt DESC').bind(id).all<any>();
  return json({
    inquiry: { ...rest, isCustomRequest: String(i.projectDescription).startsWith(CUSTOM_PREFIX), attachment: attachmentMeta(fileAttachment) },
    customerId: await customerId(env, i),
    emails: emails.results || [],
  });
}

async function attachment(env: Env, id: string): Promise<Response> {
  const i = await env.DB.prepare('SELECT fileAttachment FROM inquiries WHERE id = ?').bind(id).first<any>();
  const a = i && decodeAttachment(i.fileAttachment);
  if (!a) return json({ error: 'Attachment not found.' }, 404);
  const name = a.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 100) || 'attachment';
  return new Response(a.bytes, { headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
}

async function action(context: EventContext<Env, any, any>, me: Admin, id: string): Promise<Response> {
  const { request, env } = context;
  const b: any = (await request.json().catch(() => null)) ?? {};
  const kind = String(b.action ?? '');
  if (!['status', 'notes', 'reply', 'send-order-link', 'delete'].includes(kind)) return json({ error: 'Unknown action.' }, 400);
  const inq = await env.DB.prepare('SELECT id, fullName, email, phone, status FROM inquiries WHERE id = ?').bind(id).first<any>();
  if (!inq) return NOT_FOUND();
  await customerId(env, inq);
  const now = () => new Date().toISOString();
  const log = async (type: string, message: string) => {
    try { await env.DB.prepare('INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)').bind(now(), type, message).run(); } catch (e) { console.error('audit log failed:', e); }
  };
  const audit = (what: string) => log('inquiry', `${me.email} ${what} on inquiry ${id}`);
  // Sends first, so nothing is recorded as sent when it was not; the recipient is always the inquiry's own email
  const send = async (subject: string, body: string, type: string): Promise<Response | null> => {
    const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
    if (!smtp?.enabled) return SMTP_OFF();
    try {
      await sendSmtpEmail(env.DB, smtp, { to: inq.email, subject, body }, request);
    } catch (e: any) {
      console.error('Inquiry email failed:', e.message);
      await log('system_error', `Inquiry ${type} to ${inq.email} failed: ${e.message}`);
      return json({ error: `Email was not sent: ${e.message}` }, 502);
    }
    await env.DB.prepare('INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('eml-' + Math.random().toString(36).slice(2, 11), id, inq.email, subject, body, now(), type).run();
    return null;
  };

  switch (kind) {
    case 'status': {
      if (!STATUSES.includes(b.status)) return json({ error: 'Unknown status.' }, 400);
      await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(b.status, id).run();
      await audit(`status ${inq.status} -> ${b.status}`);
      return json({ ok: true });
    }
    case 'notes': {
      const notes = typeof b.adminNotes === 'string' ? b.adminNotes.trim() : null;
      if (notes === null || notes.length > 2000) return json({ error: 'Notes must be text of up to 2000 characters.' }, 400);
      await env.DB.prepare('UPDATE inquiries SET adminNotes = ? WHERE id = ?').bind(notes, id).run();
      await audit('notes');
      return json({ ok: true });
    }
    case 'reply': {
      const subject = text(b.subject);
      const body = text(b.body);
      if (!subject || subject.length > 150 || /[\r\n]/.test(subject)) return json({ error: 'A one-line subject of up to 150 characters is required.' }, 400);
      if (!body || body.length > 5000) return json({ error: 'A message of up to 5000 characters is required.' }, 400);
      const failed = await send(subject, body, 'admin-reply');
      if (failed) return failed;
      await env.DB.prepare("UPDATE inquiries SET status = 'In Progress' WHERE id = ? AND status = 'New'").bind(id).run();
      await audit('reply');
      return json({ ok: true });
    }
    case 'send-order-link': {
      const design = await env.DB.prepare('SELECT slug, name, packages FROM products_designs WHERE slug = ? AND active = 1').bind(text(b.designSlug)).first<any>();
      if (!design) return json({ error: 'Choose an active design.' }, 400);
      const v = validatePackages(parse(design.packages, null));
      const pkg = v.ok ? v.packages.find((p) => p.key === b.packageKey && p.kind === 'template') : null;
      if (!pkg) return json({ error: 'Choose a template package of that design.' }, 400);
      const link = `${new URL(request.url).origin}/designs/${design.slug}/customise?package=${pkg.key}`;
      const failed = await send(`Order your ${design.name} design`, `Hi ${inq.fullName},\n\nThank you for your interest. You can personalise and order the ${design.name} design (${pkg.name} package) here:\n\n${link}\n\nReply to this email if you need any help.`, 'order-link');
      if (failed) return failed;
      await env.DB.prepare("UPDATE inquiries SET status = 'Converted' WHERE id = ?").bind(id).run();
      await audit(`order link ${design.slug}/${pkg.key}`);
      return json({ ok: true });
    }
    default: {
      await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
      await audit('delete');
      return json({ ok: true });
    }
  }
}
