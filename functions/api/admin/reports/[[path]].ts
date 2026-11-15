/// <reference types="@cloudflare/workers-types" />
// Admin reports: one JSON response per Manila date range (sales, monthly, payments, orders, designs, inquiries).
import { toCsv } from '../../../../server/csv';
import { verifyAdminToken } from '../../../../server/crypto';
import { sqlUtcToIso } from '../../../../server/orders';
import { can } from '../../../../server/permissions';
import { MANILA_MS, manilaMonthKey, median, paidAtSql, parseRange } from '../../../../server/reports';
import { PAID_STATUSES, STATUSES, STATUS_LABEL } from '../../../../shared/order-status';

interface Env { DB: D1Database; JWT_SECRET?: string }

const json = (data: unknown, status = 200) => Response.json(data, { status });
const PAID = PAID_STATUSES.map((s) => `'${s}'`).join(', ');
const CUSTOM_PREFIX = 'Custom package request:';
const hours = (fromIso: string, toIso: string) => (Date.parse(sqlUtcToIso(toIso)!) - Date.parse(sqlUtcToIso(fromIso)!)) / 3600_000;
const nextMonth = (key: string) => new Date(Date.parse(`${key}-01T00:00:00Z`) + 32 * 86400_000).toISOString().slice(0, 7);
const monthStartIso = (key: string) => new Date(Date.parse(`${key}-01T00:00:00Z`) - MANILA_MS).toISOString();

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'reports.view')) return json({ error: 'Your role cannot do this.' }, 403);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const kind = path.startsWith('/api/admin/reports/export/') ? path.slice('/api/admin/reports/export/'.length) : null;
    if (request.method !== 'GET' || (path !== '/api/admin/reports' && !(kind && Object.hasOwn(EXPORTS, kind)))) return json({ error: 'Not found.' }, 404);
    const [from, to] = [url.searchParams.get('from'), url.searchParams.get('to')];
    const r = parseRange(from, to);
    if ('error' in r) return json({ error: r.error }, 400);
    if (kind) return await exportCsv(env.DB, kind, from!, to!, r);
    return json(await reportData(env.DB, from!, to!, r));
  } catch (e) {
    console.error('admin reports API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function reportData(db: D1Database, from: string, to: string, r: Exclude<ReturnType<typeof parseRange>, { error: string }>) {
  const { fromIso, toIsoExclusive: toIso, fromSql, toSqlExclusive: toSql } = r;

  // Months to chart: those the range touches, or the 12 ending at its end month when that is under 2
  const endKey = manilaMonthKey(new Date(Date.parse(toIso) - 1).toISOString());
  let startKey = manilaMonthKey(fromIso);
  if (startKey === endKey) { const [y, m] = endKey.split('-').map(Number); startKey = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 7); }
  const months: string[] = [];
  for (let [y, m] = startKey.split('-').map(Number), k = startKey; k <= endKey; [y, m] = [m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1], k = `${y}-${String(m).padStart(2, '0')}`) months.push(k);

  const paidAt = paidAtSql('o');
  const [paid, deliveries, refunds, awaiting, payStatus, payConfirmed, byStatus, inq] = await Promise.all([
    db.prepare(`SELECT o.amount_centavos AS amt, o.package_name AS pkg, d.id AS designId, d.name AS designName, ${paidAt} AS paidAt
      FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id
      WHERE o.status IN (${PAID}) AND ${paidAt} >= ? AND ${paidAt} < ?`).bind(monthStartIso(months[0]), monthStartIso(nextMonth(endKey))).all<any>(),
    db.prepare(`SELECT o.package_kind AS kind, ${paidAt} AS paidAt, o.delivered_at AS deliveredAt FROM orders o
      WHERE o.status IN (${PAID}) AND o.delivered_at >= ? AND o.delivered_at < ?
      AND EXISTS (SELECT 1 FROM order_events pe WHERE pe.order_id = o.id AND pe.kind = 'status' AND pe.to_status = 'payment_confirmed')`).bind(fromIso, toIso).all<any>(),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amt), 0) AS sum FROM (
      SELECT o.amount_centavos AS amt, MIN(e.at) AS at FROM orders o JOIN order_events e ON e.order_id = o.id AND e.kind = 'status' AND e.to_status = 'refunded'
      GROUP BY o.id) WHERE at >= ? AND at < ?`).bind(fromIso, toIso).first<any>(),
    db.prepare("SELECT COALESCE(SUM(amount_centavos), 0) AS sum FROM orders WHERE status = 'pending_payment'").first<any>(),
    db.prepare('SELECT status, COUNT(*) AS n, COALESCE(SUM(amount_centavos), 0) AS sum FROM payments WHERE submitted_at >= ? AND submitted_at < ? GROUP BY status').bind(fromIso, toIso).all<any>(),
    db.prepare("SELECT submitted_at AS s, verified_at AS v FROM payments WHERE status = 'confirmed' AND verified_at IS NOT NULL AND submitted_at >= ? AND submitted_at < ?").bind(fromIso, toIso).all<any>(),
    db.prepare('SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ? GROUP BY status').bind(fromSql, toSql).all<any>(),
    db.prepare(`SELECT status, serviceRequired AS service, substr(projectDescription, 1, ${CUSTOM_PREFIX.length}) = '${CUSTOM_PREFIX}' AS custom, COUNT(*) AS n
      FROM inquiries WHERE createdAt >= ? AND createdAt < ? GROUP BY status, serviceRequired, custom`).bind(fromIso, toIso).all<any>(),
  ]);

  // Sales, monthly and designs all come from the same paid rows
  const inRange = (paid.results || []).filter((p) => p.paidAt >= fromIso && p.paidAt < toIso);
  const revenue = inRange.reduce((s, p) => s + p.amt, 0);
  const monthly = months.map((month) => ({ month, revenueCentavos: 0, paidOrders: 0 }));
  for (const p of paid.results || []) {
    const row = monthly.find((m) => m.month === manilaMonthKey(p.paidAt));
    if (row) { row.revenueCentavos += p.amt; row.paidOrders++; }
  }
  const byDesign = new Map<number | null, { designId: number | null; name: string; paidOrders: number; revenueCentavos: number; pk: Map<string, number> }>();
  for (const p of inRange) {
    const g = byDesign.get(p.designId) ?? { designId: p.designId, name: p.designName ?? 'Unknown design', paidOrders: 0, revenueCentavos: 0, pk: new Map() };
    g.paidOrders++; g.revenueCentavos += p.amt;
    g.pk.set(p.pkg ?? 'Unknown', (g.pk.get(p.pkg ?? 'Unknown') ?? 0) + 1);
    byDesign.set(p.designId, g);
  }
  const designs = [...byDesign.values()].sort((a, b) => b.paidOrders - a.paidOrders || b.revenueCentavos - a.revenueCentavos).slice(0, 10)
    .map(({ pk, ...g }) => ({ ...g, packages: [...pk].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }));

  const pay = (s: string) => { const x = (payStatus.results || []).find((p) => p.status === s); return { count: x?.n ?? 0, centavos: x?.sum ?? 0 }; };
  const counts = Object.fromEntries((byStatus.results || []).map((s) => [s.status, s.n]));
  const kindHours = (k: string) => median((deliveries.results || []).filter((d) => (d.kind ?? 'template') === k).map((d) => hours(d.paidAt, d.deliveredAt)));

  const inqRows = inq.results || [];
  const sum = (rows: any[]) => rows.reduce((s, x) => s + x.n, 0);
  const group = (key: 'status' | 'service') => [...new Set(inqRows.map((x) => x[key]))].map((k) => ({ [key]: k, count: sum(inqRows.filter((x) => x[key] === k)) }));
  const total = sum(inqRows);

  return {
    range: { from, to },
    sales: { revenueCentavos: revenue, paidOrders: inRange.length, averageCentavos: inRange.length ? Math.round(revenue / inRange.length) : 0, refunds: { count: refunds.n, centavos: refunds.sum }, awaitingCentavos: awaiting.sum },
    monthly,
    payments: { confirmed: pay('confirmed'), submitted: pay('submitted'), rejected: pay('rejected'), medianConfirmHours: median((payConfirmed.results || []).map((p) => hours(p.s, p.v))) },
    orders: {
      byStatus: STATUSES.map((status) => ({ status, label: STATUS_LABEL[status], count: counts[status] ?? 0 })),
      funnel: {
        placed: sum(byStatus.results || []),
        paid: [...PAID_STATUSES, 'refunded'].reduce((s, k) => s + (counts[k] ?? 0), 0),
        delivered: counts.delivered ?? 0,
      },
      medianDeliveryHours: { template: kindHours('template'), custom: kindHours('custom') },
    },
    designs,
    inquiries: { total, custom: sum(inqRows.filter((x) => x.custom)), byStatus: group('status'), byService: group('service'), convertedShare: total ? sum(inqRows.filter((x) => x.status === 'Converted')) / total : 0 },
  };
}

// Manila 'YYYY-MM-DD HH:mm' from an ISO or SQL-format UTC timestamp
// A malformed legacy value is exported as stored rather than failing the whole file
const manila = (t: string | null) => {
  const ms = t ? Date.parse(sqlUtcToIso(t)!) : NaN;
  return isNaN(ms) ? t : new Date(ms + MANILA_MS).toISOString().slice(0, 16).replace('T', ' ');
};
const MAX_ROWS = 10_000;

const EXPORTS: Record<string, { headers: string[]; sql: string; sqlBounds?: boolean; row: (x: any) => (string | number | null)[]; money: number[] }> = {
  orders: {
    headers: ['Reference', 'Created', 'Status', 'Design', 'Package', 'Package kind', 'Amount', 'Customer', 'Customer email', 'Paid at', 'Delivered at'],
    sql: `SELECT o.reference, o.created_at, o.status, d.name AS design, o.package_name, o.package_kind, o.amount_centavos, c.name AS customer, o.customer_email,
      CASE WHEN o.status IN (${PAID}) THEN ${paidAtSql('o')} END AS paidAt, o.delivered_at
      FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.created_at >= ? AND o.created_at < ? ORDER BY o.created_at, o.id LIMIT ${MAX_ROWS + 1}`,
    sqlBounds: true,
    row: (x) => [x.reference, manila(x.created_at), STATUS_LABEL[x.status as keyof typeof STATUS_LABEL] ?? x.status, x.design, x.package_name, x.package_kind, x.amount_centavos, x.customer, x.customer_email, manila(x.paidAt), manila(x.delivered_at)],
    money: [6],
  },
  payments: {
    headers: ['Order reference', 'Submitted', 'Status', 'Provider', 'Amount', 'Customer reference', 'Verified at', 'Verified by', 'Admin reference'],
    sql: `SELECT o.reference, p.submitted_at, p.status, p.provider, p.amount_centavos, p.customer_reference, p.verified_at, p.verified_by, p.admin_reference
      FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.submitted_at >= ? AND p.submitted_at < ? ORDER BY p.submitted_at, p.id LIMIT ${MAX_ROWS + 1}`,
    row: (x) => [x.reference, manila(x.submitted_at), x.status, x.provider, x.amount_centavos, x.customer_reference, manila(x.verified_at), x.verified_by, x.admin_reference],
    money: [4],
  },
  inquiries: {
    headers: ['Received', 'Name', 'Company', 'Email', 'Phone', 'Service', 'Status', 'Budget'],
    sql: `SELECT createdAt, fullName, companyName, email, phone, serviceRequired, status, budget
      FROM inquiries WHERE createdAt >= ? AND createdAt < ? ORDER BY createdAt, id LIMIT ${MAX_ROWS + 1}`,
    row: (x) => [manila(x.createdAt), x.fullName, x.companyName, x.email, x.phone, x.serviceRequired, x.status, x.budget],
    money: [],
  },
};

async function exportCsv(db: D1Database, kind: string, from: string, to: string, r: Exclude<ReturnType<typeof parseRange>, { error: string }>) {
  const e = EXPORTS[kind];
  const { results } = await db.prepare(e.sql).bind(...(e.sqlBounds ? [r.fromSql, r.toSqlExclusive] : [r.fromIso, r.toIsoExclusive])).all<any>();
  if (results.length > MAX_ROWS) return json({ error: 'Too many rows — narrow the range.' }, 413);
  return new Response(toCsv(e.headers, results.map(e.row), e.money), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-${from}-to-${to}.csv"`, 'Cache-Control': 'private, no-store' },
  });
}
