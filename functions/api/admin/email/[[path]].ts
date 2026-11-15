/// <reference types="@cloudflare/workers-types" />
// Admin email settings: SMTP, the auto-reply template, and a test send. Super Admin only.
// Template placeholders (filled by POST /api/inquiry): {{name}} {{service}} {{projectDescription}} {{preferredContact}} {{companyEmail}} {{companyPhone}}
import { verifyAdminToken } from '../../../../server/crypto';
import { EMAIL_RE, sendSmtpEmail } from '../../../../server/email';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'settings.email')) return json({ error: 'Your role cannot do this.' }, 403);
    if (new URL(request.url).pathname.replace(/\/+$/, '') !== '/api/admin/email') return json({ error: 'Not found.' }, 404);
    if (request.method === 'GET') return await read(env);
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    const b: any = (await request.json().catch(() => null)) ?? {};
    if (b.section === 'smtp') return await saveSmtp(env, me, b);
    if (b.section === 'template') return await saveTemplate(env, me, b);
    if (b.section === 'test') return await test(context, me);
    return json({ error: 'Unknown section.' }, 400);
  } catch (e) {
    console.error('admin email API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

const audit = (env: Env, message: string) =>
  env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)").bind(new Date().toISOString(), message).run()
    .catch((e) => console.error('audit log failed:', e));

const getSmtp = (env: Env) => env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first<any>();

async function read(env: Env): Promise<Response> {
  const [s, t] = await Promise.all([getSmtp(env), env.DB.prepare("SELECT subject, body FROM email_template WHERE id = 'default'").first<any>()]);
  return json({
    smtp: {
      host: s?.host ?? '', port: s?.port ?? 587, username: s?.username ?? '', senderName: s?.senderName ?? '',
      senderEmail: s?.senderEmail ?? '', signature: s?.signature ?? '', enabled: !!s?.enabled, passwordSet: !!s?.password,
    },
    template: { subject: t?.subject ?? '', body: t?.body ?? '' },
  });
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null);

async function saveSmtp(env: Env, me: Admin, b: any): Promise<Response> {
  const host = text(b.host, 200);
  const username = text(b.username ?? '', 200);
  const senderName = text(b.senderName ?? '', 100);
  const senderEmail = text(b.senderEmail, 200);
  const signature = text(b.signature ?? '', 1000);
  const port = typeof b.port === 'number' || (typeof b.port === 'string' && /^\d+$/.test(b.port)) ? Number(b.port) : NaN;
  if (!host) return json({ error: 'Enter the SMTP host.' }, 400);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return json({ error: 'Port must be between 1 and 65535.' }, 400);
  if (!senderEmail || !EMAIL_RE.test(senderEmail)) return json({ error: 'Enter a valid sender email.' }, 400);
  if (username === null || senderName === null || signature === null) return json({ error: 'A field is too long.' }, 400);
  if (b.password !== undefined && typeof b.password !== 'string') return json({ error: 'Invalid password.' }, 400);
  const old = await getSmtp(env);
  const password = b.clearPassword === true ? '' : b.password ? b.password : old?.password ?? '';
  await env.DB.prepare(`INSERT INTO smtp_settings (id, host, port, username, password, senderName, senderEmail, signature, enabled)
    VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(id) DO UPDATE SET host = ?1, port = ?2, username = ?3, password = ?4, senderName = ?5, senderEmail = ?6, signature = ?7, enabled = ?8`)
    .bind(host, port, username, password, senderName, senderEmail, signature, b.enabled === true || b.enabled === 1 ? 1 : 0).run();
  await audit(env, `${me.email} updated SMTP settings`);
  return json({ ok: true, passwordSet: !!password });
}

async function saveTemplate(env: Env, me: Admin, b: any): Promise<Response> {
  const subject = text(b.subject, 150);
  const body = text(b.body, 5000);
  if (!subject || !body) return json({ error: 'Subject (up to 150 characters) and body (up to 5000) are required.' }, 400);
  await env.DB.prepare("INSERT INTO email_template (id, subject, body) VALUES ('default', ?1, ?2) ON CONFLICT(id) DO UPDATE SET subject = ?1, body = ?2").bind(subject, body).run();
  await audit(env, `${me.email} updated the auto-reply template`);
  return json({ ok: true });
}

async function test(context: EventContext<Env, any, any>, me: Admin): Promise<Response> {
  const { env, request } = context;
  const smtp = await getSmtp(env);
  if (!smtp?.host) return json({ error: 'Save your SMTP settings first.' }, 400);
  try {
    await sendSmtpEmail(env.DB, { ...smtp, enabled: 1 }, { to: me.email, subject: 'JLC Solutions test email', body: 'This is a test email. Your SMTP settings work.' }, request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: smtp.password ? msg.split(smtp.password).join('•••') : msg }, 502);
  }
  return json({ ok: true, sentTo: me.email });
}
