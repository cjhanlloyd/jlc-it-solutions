/// <reference types="@cloudflare/workers-types" />
// Admin dashboard: needs-action counts, new orders, status mix, recent activity and (reports.view) money. Days and months are Asia/Manila.
import { verifyAdminToken } from '../../../server/crypto';
import { editorScope } from '../../../server/orders';
import { can } from '../../../server/permissions';
import { DAY_MS, MANILA_MS, manilaMonthKey, paidAtSql, parseRange, sqlTime } from '../../../server/reports';
import { migrationWarning, missingMigrations } from '../../../server/schema-check';
import { PAID_STATUSES, STATUSES, STATUS_LABEL, type OrderStatus } from '../../../shared/order-status';

interface Env { DB: D1Database; JWT_SECRET?: string }

const PAID = PAID_STATUSES.map((s) => `'${s}'`).join(', ');

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(me.role, 'orders.view')) return Response.json({ error: 'Your role cannot do this.' }, { status: 403 });
    const range = new URL(request.url).searchParams.get('range') ?? '30d';
    if (!Object.hasOwn(RANGE_DAYS, range)) return Response.json({ error: 'Choose 7d, 30d, 90d or 12m.' }, { status: 400 });
    // Super Admins (who run migrations) see a warning when the live database is behind the code
    const missing = can(me.role, 'users.manage') ? await missingMigrations(env.DB) : [];
    try {
      const data = await dashboardData(env.DB, me.role, me.email, new Date(), range);
      return Response.json(missing.length ? { ...data, schemaWarning: migrationWarning(missing) } : data);
    } catch (e) {
      if (missing.length) return Response.json({ error: migrationWarning(missing) }, { status: 500 });
      throw e;
    }
  } catch (e) {
    console.error('admin dashboard API error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
};

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 0 };

export async function dashboardData(db: D1Database, role: string, email: string, now: Date, range = '30d') {
  const editor = role === 'Editor';
  const scope = editor ? ' AND ' + editorScope('?1') : '';
  const args = editor ? [email] : [];
  // Start of the Manila day / month containing `now`, as UTC ms
  const m = new Date(now.getTime() + MANILA_MS);
  const today = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()) - MANILA_MS;
  const monthStart = (back: number) => Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - back, 1) - MANILA_MS;
  const n = (sql: string, ...extra: unknown[]) => db.prepare(sql).bind(...args, ...extra).first<any>();
  const created = (from: number) => `SELECT COUNT(*) AS n FROM orders o WHERE o.created_at >= '${sqlTime(from)}'${scope}`;

  // The first time an order entered `to`, so a bounced-and-reconfirmed order counts once
  const first = (to: string) => `SELECT order_id, MIN(at) AS at FROM order_events WHERE kind = 'status' AND to_status = '${to}' GROUP BY order_id`;
  const month = async (back: number) => {
    const [from, to] = [new Date(monthStart(back)).toISOString(), new Date(monthStart(back - 1)).toISOString()];
    const rev = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(o.amount_centavos), 0) AS sum FROM orders o WHERE ${paidAtSql('o')} >= ? AND ${paidAtSql('o')} < ? AND o.status IN (${PAID})`).bind(from, to).first<any>();
    const del = await db.prepare(`SELECT COUNT(*) AS n FROM orders o JOIN (${first('delivered')}) e ON e.order_id = o.id WHERE e.at >= ? AND e.at < ?`).bind(from, to).first<any>();
    return { revenueCentavos: rev.sum, delivered: del.n, averageCentavos: rev.n ? Math.round(rev.sum / rev.n) : 0 };
  };

  const [statusRows, todayN, weekN, pending, recent] = await Promise.all([
    db.prepare(`SELECT o.status, COUNT(*) AS n, SUM(o.amount_centavos) AS sum FROM orders o WHERE 1 = 1${scope} GROUP BY o.status`).bind(...args).all<any>(),
    n(created(today)), n(created(today - 6 * DAY_MS)),
    n(`SELECT COUNT(*) AS n FROM orders o WHERE o.status = 'pending_payment'${scope}`),
    db.prepare(`SELECT e.at, e.actor, e.kind, e.to_status, e.note, o.id, o.reference FROM order_events e JOIN orders o ON o.id = e.order_id WHERE 1 = 1${scope} ORDER BY e.at DESC, e.id DESC LIMIT 15`).bind(...args).all<any>(),
  ]);
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  let pendingCentavos = 0;
  for (const r of statusRows.results || []) {
    if (r.status in statusCounts) statusCounts[r.status as OrderStatus] = r.n;
    if (r.status === 'pending_payment') pendingCentavos += r.sum;
  }

  // Charts are optional: a failure here (say, a missing migration) must not take down the tiles
  const charts = await chartData(db, role, scope, args, range, today, monthStart(11), now).catch((e) => { console.error('admin dashboard charts error:', e instanceof Error ? e.message : e); return null; });

  return {
    charts,
    needsAction: { paymentVerification: statusCounts.payment_verification, forReview: statusCounts.for_review, revisionRequested: statusCounts.revision_requested },
    newOrders: { today: todayN.n, last7: weekN.n },
    pendingPayments: { count: pending.n },
    statusCounts,
    recent: (recent.results || []).map((r) => ({
      at: r.at, reference: r.reference, orderId: r.id, actor: r.actor,
      label: r.kind === 'status' ? STATUS_LABEL[r.to_status as OrderStatus] ?? r.to_status : r.note,
    })),
    ...(can(role, 'reports.view') ? { money: { pendingCentavos, thisMonth: await month(0), lastMonth: await month(1) } } : {}),
  };
}

// Charts for a range ending today (Manila). Orders by created_at, money by the same paid-at rule as Reports.
async function chartData(db: D1Database, role: string, scope: string, args: string[], range: string, today: number, month11: number, now: Date) {
  const monthly = range === '12m';
  const startMs = monthly ? month11 : today - (RANGE_DAYS[range] - 1) * DAY_MS;
  const day = (ms: number) => new Date(ms + MANILA_MS).toISOString().slice(0, 10);
  const r = parseRange(day(startMs), day(today)) as Exclude<ReturnType<typeof parseRange>, { error: string }>;
  const key = (iso: string) => (monthly ? manilaMonthKey(iso) : day(Date.parse(iso)));
  const buckets: string[] = [];
  for (let ms = startMs; ms <= today;) {
    buckets.push(monthly ? day(ms).slice(0, 7) : day(ms));
    const m = new Date(ms + MANILA_MS);
    ms = monthly ? Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1) - MANILA_MS : ms + DAY_MS;
  }
  const idx = new Map(buckets.map((b, i) => [b, i]));
  const zeros = () => buckets.map(() => 0);

  const k = args.length;
  const withMoney = can(role, 'reports.view');
  const [orderRows, paid, pay] = await Promise.all([
    db.prepare(`SELECT substr(datetime(o.created_at, '+8 hours'), 1, ${monthly ? 7 : 10}) AS b, o.package_kind = 'custom' AS custom, o.status, COUNT(*) AS n
      FROM orders o WHERE o.created_at >= ?${k + 1} AND o.created_at < ?${k + 2}${scope} GROUP BY b, custom, o.status`).bind(...args, r.fromSql, r.toSqlExclusive).all<any>(),
    withMoney ? db.prepare(`SELECT o.amount_centavos AS amt, d.id AS designId, d.name AS designName, ${paidAtSql('o')} AS paidAt
      FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id
      WHERE o.status IN (${PAID}) AND ${paidAtSql('o')} >= ? AND ${paidAtSql('o')} < ?`).bind(r.fromIso, r.toIsoExclusive).all<any>() : null,
    withMoney ? db.prepare('SELECT status, COUNT(*) AS n FROM payments WHERE submitted_at >= ? AND submitted_at < ? GROUP BY status').bind(r.fromIso, r.toIsoExclusive).all<any>() : null,
  ]);

  const orders = { template: zeros(), custom: zeros() };
  const mix = new Map<string, number>();
  for (const o of orderRows.results || []) {
    const i = idx.get(o.b);
    if (i !== undefined) orders[o.custom ? 'custom' : 'template'][i] += o.n;
    mix.set(o.status, (mix.get(o.status) ?? 0) + o.n);
  }
  const out: Record<string, unknown> = {
    range, bucket: monthly ? 'month' : 'day', buckets, orders,
    statusMix: STATUSES.map((status) => ({ status, label: STATUS_LABEL[status], count: mix.get(status) ?? 0 })),
    asOf: now.toISOString(),
  };
  if (paid && pay) {
    const revenue = zeros();
    const byDesign = new Map<number | null, { name: string; paidOrders: number; revenue: number }>();
    for (const p of paid.results || []) {
      const i = idx.get(key(p.paidAt));
      if (i !== undefined) revenue[i] += p.amt;
      const g = byDesign.get(p.designId) ?? { name: p.designName ?? 'Unknown design', paidOrders: 0, revenue: 0 };
      g.paidOrders++; g.revenue += p.amt;
      byDesign.set(p.designId, g);
    }
    const count = (s: string) => (pay.results || []).find((x) => x.status === s)?.n ?? 0;
    out.revenue = revenue;
    out.payments = { confirmed: count('confirmed'), submitted: count('submitted'), rejected: count('rejected') };
    // Same grouping and ordering as Reports
    out.topDesigns = [...byDesign.values()].sort((a, b) => b.paidOrders - a.paidOrders || b.revenue - a.revenue).slice(0, 5).map(({ name, paidOrders }) => ({ name, paidOrders }));
  }
  return out;
}
