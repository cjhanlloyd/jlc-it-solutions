/// <reference types="@cloudflare/workers-types" />
import { runCleanup } from '../../../../server/cleanup';
import { verifyAdminToken } from '../../../../server/crypto';
import { can } from '../../../../server/permissions';
import { occasionOf } from '../../../../shared/occasions';
import { PAID_STATUSES } from '../../../../shared/order-status';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/invitations/, '');
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'orders.view')) return json({ error: 'Your role cannot do this.' }, 403);

    const route = `${request.method} ${path}`;
    if (route === 'GET /overview') return await overview(env, can(me.role, 'reports.view'));
    const rsvpsId = route.match(/^GET \/invitations\/(\d+)\/rsvps$/)?.[1];
    if (rsvpsId) return await rsvps(env, Number(rsvpsId));
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin invitations API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// Display title from the stored details; '' when the type or details are unknown.
function titleOf(productType: string, details: string | null): string {
  const o = occasionOf(productType);
  try { return o && details ? o.title(JSON.parse(details)) : ''; } catch { return ''; }
}

async function overview(env: Env, money: boolean): Promise<Response> {
  // shortcut: cleanup runs when an admin opens the overview, because Pages has no cron; upgrade to a Worker cron trigger if orders grow.
  try {
    await runCleanup(env.DB, env.PHOTOS, new Date());
  } catch (e) {
    console.error('cleanup failed:', e instanceof Error ? e.message : e);
  }
  // Orders live in the admin portal (/api/admin/orders); only the paid totals stay here
  const [invitations, totals] = await Promise.all([
    env.DB.prepare(
      'SELECT i.id, i.slug, i.status, i.event_date, i.created_at, i.details, d.product_type, d.name AS design_name, (SELECT COUNT(*) FROM rsvps r WHERE r.invitation_id = i.id) AS rsvpCount FROM invitations i JOIN products_designs d ON d.id = i.design_id ORDER BY i.id DESC',
    ).all<any>(),
    env.DB.prepare(`SELECT COUNT(*) AS paidCount, COALESCE(SUM(amount_centavos), 0) AS paidCentavos FROM orders WHERE status IN (${PAID_STATUSES.map(() => '?').join(', ')})`)
      .bind(...PAID_STATUSES).first<any>(),
  ]);
  return json({
    invitations: (invitations.results || []).map(({ details, product_type, ...i }) => ({ ...i, title: titleOf(product_type, details) })),
    // Money stays with reports.view, as on the dashboard
    ...(money ? { totals: { paidCount: totals?.paidCount ?? 0, paidCentavos: totals?.paidCentavos ?? 0 } } : {}),
  });
}

async function rsvps(env: Env, id: number): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT guest_name, attending, party_size, kids_count, message, created_at FROM rsvps WHERE invitation_id = ? ORDER BY created_at, id',
  ).bind(id).all<any>();
  return json({ rsvps: (results || []).map((r) => ({ guestName: r.guest_name, attending: !!r.attending, partySize: r.party_size, kidsCount: r.kids_count ?? 0, message: r.message ?? '', submitted: r.created_at })) });
}
