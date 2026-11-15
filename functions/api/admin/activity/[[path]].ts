/// <reference types="@cloudflare/workers-types" />
// Admin activity: the audit log, filterable by group, searchable, paged.
import { verifyAdminToken } from '../../../../server/crypto';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const PER_PAGE = 50;
const TYPES: Record<string, string[]> = {
  signin: ['auth_success'], failed: ['auth_failure'], security: ['security'], errors: ['system_error'],
  inquiries: ['inquiry'], orders: ['order', 'invitation_resend'], content: ['content', 'design'], customers: ['customer'],
};
const inList = (types: string[]) => `log_type IN (${types.map((t) => `'${t}'`).join(', ')})`;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'activity.view')) return json({ error: 'Your role cannot do this.' }, 403);
    if (request.method !== 'GET' || new URL(request.url).pathname.replace(/\/+$/, '') !== '/api/admin/activity') return json({ error: 'Not found.' }, 404);

    const params = new URL(request.url).searchParams;
    const type = params.get('type') || 'all';
    if (type !== 'all' && !TYPES[type]) return json({ error: 'Unknown filter.' }, 400);
    const where: string[] = [];
    const args: unknown[] = [];
    if (type !== 'all') where.push(inList(TYPES[type]));
    const q = params.get('q')?.trim();
    if (q) {
      args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
      where.push("message LIKE ?1 ESCAPE '\\'");
    }
    const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs${filter}`).bind(...args).first<any>();
    const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PER_PAGE));
    const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
    const [rows, c] = await Promise.all([
      env.DB.prepare(`SELECT id, timestamp, log_type, message FROM audit_logs${filter} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`).bind(...args).all<any>(),
      env.DB.prepare(`SELECT COUNT(*) AS "all", ${Object.entries(TYPES).map(([k, t]) => `COALESCE(SUM(${inList(t)}), 0) AS ${k}`).join(', ')} FROM audit_logs`).first<any>(),
    ]);
    return json({
      logs: (rows.results || []).map((r) => ({ id: r.id, timestamp: r.timestamp, logType: r.log_type, message: r.message })),
      counts: c, page, pages,
    });
  } catch (e) {
    console.error('admin activity API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};
