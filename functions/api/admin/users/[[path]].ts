/// <reference types="@cloudflare/workers-types" />
// Admin users: list, invite, change role, disable/enable, resend invite, send reset, delete. Super Admin only.
import { cleanName, NAME_MAX, sendInvite, sendReset } from '../../../../server/admin-accounts';
import { verifyAdminToken } from '../../../../server/crypto';
import { EMAIL_RE } from '../../../../server/email';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const ROLES = ['Super Admin', 'Administrator', 'Editor'];
const DAY = 24 * 60 * 60 * 1000;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/users/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'users.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    if (request.method === 'GET' && path === '') return await list(env, me);
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    const b: any = (await request.json().catch(() => null)) ?? {};
    if (path === '') return b.action === 'invite' ? await invite(context, me, b) : json({ error: 'Unknown action.' }, 400);
    const m = path.match(/^\/([^/]+)$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    let email: string;
    try { email = decodeURIComponent(m[1]).toLowerCase().trim(); } catch { return json({ error: 'Not found.' }, 404); }
    return await act(context, me, email, b);
  } catch (e) {
    console.error('admin users API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

const audit = (env: Env, message: string) =>
  env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)").bind(new Date().toISOString(), message).run()
    .catch((e) => console.error('audit log failed:', e));

async function list(env: Env, me: Admin): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT email, fullName, role, status, verified, createdAt FROM admins ORDER BY createdAt').all<any>();
  return json({ users: (results || []).map((u) => ({ ...u, verified: !!u.verified })), me: me.email });
}

async function invite(context: EventContext<Env, any, any>, me: Admin, b: any): Promise<Response> {
  const { env, request } = context;
  const email = typeof b.email === 'string' ? b.email.toLowerCase().trim() : '';
  const fullName = cleanName(b.fullName);
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  if (!fullName || b.fullName.trim().length > NAME_MAX) return json({ error: 'Name must be 1 to 80 characters.' }, 400);
  if (!ROLES.includes(b.role)) return json({ error: 'Pick a valid role.' }, 400);
  if (await env.DB.prepare('SELECT email FROM admins WHERE email = ?').bind(email).first()) return json({ error: 'A user with this email already exists.' }, 409);
  const token = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO admins (email, fullName, role, status, verified, verificationToken, verificationTokenExpires, createdAt) VALUES (?, ?, ?, 'Invited', 0, ?, ?, ?)")
    .bind(email, fullName, b.role, token, new Date(Date.now() + DAY).toISOString(), new Date().toISOString()).run();
  const { emailed, link } = await sendInvite(env.DB, request, { email, fullName, role: b.role }, token);
  await audit(env, `${me.email} invited ${email} as ${b.role}`);
  return json({ ok: true, emailed, ...(emailed ? {} : { inviteLink: link }) });
}

async function act(context: EventContext<Env, any, any>, me: Admin, email: string, b: any): Promise<Response> {
  const { env, request } = context;
  const db = env.DB;
  const t = await db.prepare('SELECT email, fullName, role, status, verified FROM admins WHERE email = ?').bind(email).first<any>();
  if (!t) return json({ error: 'User not found.' }, 404);
  const self = email === me.email.toLowerCase();
  const lastSuper = async () => {
    if (!(t.role === 'Super Admin' && t.status === 'Active' && t.verified)) return false;
    const n = await db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'Super Admin' AND status = 'Active' AND verified = 1").first<any>();
    return n.n <= 1;
  };
  const LAST = 'There must be at least one active Super Admin.';

  switch (b.action) {
    case 'role':
      if (!ROLES.includes(b.role)) return json({ error: 'Pick a valid role.' }, 400);
      if (self) return json({ error: 'You cannot change your own role.' }, 409);
      if (b.role !== 'Super Admin' && (await lastSuper())) return json({ error: LAST }, 409);
      await db.prepare('UPDATE admins SET role = ? WHERE email = ?').bind(b.role, email).run();
      await audit(env, `${me.email} changed role of ${email} from ${t.role} to ${b.role}`);
      return json({ ok: true });
    case 'disable':
      if (self) return json({ error: 'You cannot disable your own account.' }, 409);
      if (await lastSuper()) return json({ error: LAST }, 409);
      await db.prepare("UPDATE admins SET status = 'Disabled', verificationToken = NULL, verificationTokenExpires = NULL, resetToken = NULL, resetTokenExpires = NULL WHERE email = ?").bind(email).run();
      await audit(env, `${me.email} disabled ${email}`);
      return json({ ok: true });
    case 'enable':
      if (t.status !== 'Disabled' || !t.verified) return json({ error: 'Only a disabled, verified user can be enabled.' }, 409);
      await db.prepare("UPDATE admins SET status = 'Active' WHERE email = ?").bind(email).run();
      await audit(env, `${me.email} enabled ${email}`);
      return json({ ok: true });
    case 'resend-invite': {
      if (t.verified || t.status !== 'Invited') return json({ error: t.status === 'Disabled' ? 'This account is disabled.' : 'This user has already accepted the invitation.' }, 409);
      const token = crypto.randomUUID();
      await db.prepare('UPDATE admins SET verificationToken = ?, verificationTokenExpires = ? WHERE email = ?').bind(token, new Date(Date.now() + DAY).toISOString(), email).run();
      const { emailed, link } = await sendInvite(db, request, t, token);
      await audit(env, `${me.email} resent the invitation to ${email}`);
      return json({ ok: true, emailed, ...(emailed ? {} : { inviteLink: link }) });
    }
    case 'send-reset': {
      if (t.status !== 'Active') return json({ error: 'Only an active user can be sent a reset link.' }, 409);
      const smtp = await db.prepare("SELECT enabled FROM smtp_settings WHERE id = 'default'").first<any>();
      if (!smtp?.enabled) return json({ error: 'Email is off. Turn it on in Email settings first.' }, 400);
      const token = crypto.randomUUID();
      await db.prepare('UPDATE admins SET resetToken = ?, resetTokenExpires = ? WHERE email = ?').bind(token, new Date(Date.now() + 60 * 60 * 1000).toISOString(), email).run();
      const { emailed } = await sendReset(db, request, t, token);
      await audit(env, `${me.email} sent a password reset to ${email}`);
      return json({ ok: true, emailed });
    }
    case 'delete':
      if (self) return json({ error: 'You cannot delete your own account.' }, 409);
      if (await lastSuper()) return json({ error: LAST }, 409);
      await db.batch([
        db.prepare('UPDATE orders SET assigned_to = NULL WHERE assigned_to = ?').bind(email),
        db.prepare('DELETE FROM admins WHERE email = ?').bind(email),
      ]);
      await audit(env, `${me.email} deleted ${email}`);
      return json({ ok: true });
    default:
      return json({ error: 'Unknown action.' }, 400);
  }
}
