/// <reference types="@cloudflare/workers-types" />
// Admin reviews: list by status, approve, reject (with a reason), delete. Requires reviews.manage.
import { verifyAdminToken } from '../../../../server/crypto';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const STATUSES = ['pending', 'approved', 'rejected'];

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'reviews.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    if (url.pathname.replace(/\/+$/, '') !== '/api/admin/reviews') return json({ error: 'Not found.' }, 404);
    if (request.method === 'GET') {
      const status = url.searchParams.get('status') ?? 'pending';
      const where = STATUSES.includes(status) ? 'WHERE status = ?' : '';
      const stmt = env.DB.prepare(`SELECT * FROM reviews ${where} ORDER BY updated_at DESC, id DESC LIMIT 200`);
      const [list, pending] = await Promise.all([
        (where ? stmt.bind(status) : stmt).all<any>(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'").first<any>(),
      ]);
      return json({
        pendingCount: pending?.n ?? 0,
        reviews: (list.results || []).map((r) => ({
          id: r.id, displayName: r.display_name, rating: r.rating, body: r.body, status: r.status, rejectReason: r.reject_reason, customerEmail: r.customer_email,
          createdAt: r.created_at, updatedAt: r.updated_at, moderatedAt: r.moderated_at, moderatedBy: r.moderated_by,
        })),
      });
    }
    if (request.method === 'POST') return await action(env, me, (await request.json().catch(() => null)) ?? {});
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin reviews API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function action(env: Env, me: { email: string }, b: any): Promise<Response> {
  const id = b.id;
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'A review id is required.' }, 400);
  const now = new Date().toISOString();
  let reason = '';
  if (b.action === 'reject') {
    reason = typeof b.reason === 'string' ? b.reason.replace(/[\u0000-\u001F\u007F]/g, ' ').trim() : '';
    if (reason.length > 300) return json({ error: 'The reason can be up to 300 characters.' }, 400);
  }
  let done: any;
  if (b.action === 'approve') done = await env.DB.prepare("UPDATE reviews SET status = 'approved', reject_reason = NULL, moderated_at = ?, moderated_by = ? WHERE id = ? RETURNING id").bind(now, me.email, id).first();
  else if (b.action === 'reject') done = await env.DB.prepare("UPDATE reviews SET status = 'rejected', reject_reason = ?, moderated_at = ?, moderated_by = ? WHERE id = ? RETURNING id").bind(reason || null, now, me.email, id).first();
  else if (b.action === 'delete') done = await env.DB.prepare('DELETE FROM reviews WHERE id = ? RETURNING id').bind(id).first();
  else return json({ error: 'Unknown action.' }, 400);
  if (!done) return json({ error: 'Review not found.' }, 404);
  try { await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'review', ?)").bind(now, `${me.email} ${{ approve: 'approved', reject: 'rejected', delete: 'deleted' }[b.action as string]} review #${id}`).run(); } catch (e) { console.error('audit log failed:', e); }
  return json({ ok: true });
}
