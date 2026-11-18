/// <reference types="@cloudflare/workers-types" />
import { runCleanup } from '../../../../server/cleanup';
import { verifyAdminToken } from '../../../../server/crypto';
import { listGuestPhotos, mediaPreview, moderateGuestPhotos } from '../../../../server/guest-photos';
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

    // Event features panel and guest photo moderation: content.manage (moderation of public content)
    const ef = route.match(/^(GET|POST) \/invitations\/(\d{1,15})\/(features|guest-photos|media\/(\d{1,15}))$/);
    if (ef) {
      if (!can(me.role, 'content.manage')) return json({ error: 'Your role cannot do this.' }, 403);
      const inv = await env.DB.prepare('SELECT id, tier, extras FROM invitations WHERE id = ?').bind(Number(ef[2])).first<any>();
      if (!inv) return json({ error: 'Invitation not found.' }, 404);
      if (ef[1] === 'GET' && ef[3] === 'features') return await features(env, inv);
      if (ef[1] === 'GET' && ef[4]) return await mediaPreview(env, inv.id, Number(ef[4]), request);
      if (ef[1] === 'POST' && ef[3] === 'guest-photos') return await moderateGuestPhotos(env, inv.id, await request.json().catch(() => ({})));
    }
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

// The Event features panel: what is switched on, check-in totals, wish list reservations (read-only) and guest photos.
async function features(env: Env, inv: any): Promise<Response> {
  let e: any = {};
  try { e = JSON.parse(inv.extras || '{}') ?? {}; } catch { /* treated as nothing set */ }
  const [attire, gifts, checkin, reserved, guestPhotos] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM invitation_media WHERE invitation_id = ? AND kind = 'attire'").bind(inv.id).first<any>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM gift_items WHERE invitation_id = ?').bind(inv.id).first<any>(),
    env.DB.prepare('SELECT COUNT(*) AS guests, COUNT(checked_in_at) AS checkedIn, COALESCE(SUM(checked_in_count), 0) AS people FROM invitation_guests WHERE invitation_id = ?').bind(inv.id).first<any>(),
    env.DB.prepare('SELECT name, reserved_name, reserved_at FROM gift_items WHERE invitation_id = ? AND reserved_at IS NOT NULL ORDER BY reserved_at').bind(inv.id).all<any>(),
    listGuestPhotos(env.DB, inv.id),
  ]);
  const a = e.attire ?? {};
  return json({
    tier: inv.tier === 'premium' ? 'premium' : 'standard',
    inUse: {
      attire: !!(a.motif || a.palette?.length || a.notes || attire?.n),
      galleryLayout: e.gallery?.layout ?? 'grid',
      giftItems: gifts?.n ?? 0,
      giftMethods: e.gifts?.methods?.length ?? 0,
      guestPhotos: e.guestPhotos?.enabled === true,
      booth: e.booth?.enabled === true,
      checkin: e.checkin?.enabled === true,
    },
    checkin: { guests: checkin?.guests ?? 0, checkedIn: checkin?.checkedIn ?? 0, people: checkin?.people ?? 0 },
    reservations: (reserved.results || []).map((r) => ({ item: r.name, name: r.reserved_name, at: r.reserved_at })),
    ...guestPhotos,
  });
}
