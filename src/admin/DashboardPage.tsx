// Dashboard (#/dashboard): needs-action tiles, new orders, money, status mix, recent activity and range charts.
import { useEffect, useRef, useState } from 'react';
import { STATUSES, type OrderStatus } from '../../shared/order-status';
import { peso } from '../invitations/kit';
import { Button, Card, Spinner, StatusPill } from '../ui';
import type { Session } from './api';
import { groupStatusMix } from './chart-helpers';
import { BarChart, Doughnut, HBarChart, LineChart } from './charts';

type Month = { revenueCentavos: number; delivered: number; averageCentavos: number };
type Data = {
  needsAction: { paymentVerification: number; forReview: number; revisionRequested: number };
  schemaWarning?: string;
  newOrders: { today: number; last7: number };
  pendingPayments: { count: number };
  statusCounts: Record<OrderStatus, number>;
  recent: { at: string; reference: string; orderId: number; label: string; actor: string }[];
  money?: { pendingCentavos: number; thisMonth: Month; lastMonth: Month };
  charts: {
    range: Range; bucket: 'day' | 'month'; buckets: string[]; asOf: string;
    orders: { template: number[]; custom: number[] };
    statusMix: { status: string; label: string; count: number }[];
    revenue?: number[];
    payments?: { confirmed: number; submitted: number; rejected: number };
    topDesigns?: { name: string; paidOrders: number }[];
  } | null;
};

const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['12m', '12 months']] as const;
type Range = (typeof RANGES)[number][0];
const RANGE_KEY = 'jlc_admin_dash_range';
function savedRange(): Range {
  try {
    const r = localStorage.getItem(RANGE_KEY);
    if (RANGES.some(([k]) => k === r)) return r as Range;
  } catch { /* storage blocked: use the default */ }
  return '30d';
}

const manila = (s: string) => new Date(s).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

function Tile({ label, value, href, sub }: { label: string; value: number; href?: string; sub?: string }) {
  const body = (
    <Card className="h-full">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-700">{sub}</p>}
    </Card>
  );
  return href ? <a href={href} className="block rounded-card focus-visible:outline-2 hover:opacity-90">{body}</a> : body;
}

export default function DashboardPage({ session }: { session: Session }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>(savedRange);
  const [loading, setLoading] = useState(false);
  const req = useRef(0);
  useEffect(() => {
    // Only the newest request may update the page; older responses are dropped
    const load = () => {
      const id = ++req.current;
      setLoading(true);
      session.api<Data>(`/api/admin/dashboard?range=${range}`)
        .then((d) => { if (id === req.current) { setData(d); setError(''); } })
        .catch((e: Error) => { if (id === req.current) setError(e.message); })
        .finally(() => { if (id === req.current) setLoading(false); });
    };
    load();
    const ifVisible = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(ifVisible, 60_000);
    document.addEventListener('visibilitychange', ifVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', ifVisible); req.current++; };
  }, [session, range]);
  const choose = (r: Range) => {
    setRange(r);
    try { localStorage.setItem(RANGE_KEY, r); } catch { /* not remembered */ }
  };

  if (error && !data) return <p role="alert" className="text-sm font-medium text-red-700">{error}</p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading dashboard…</p>;
  const { needsAction: na, money } = data;
  const max = Math.max(1, ...STATUSES.map((s) => data.statusCounts[s]));
  // OrdersPage opens on its "Needs action" tab, which is where these tiles point
  const orders = '#/orders';
  const c = data.charts;
  const per = c?.bucket === 'month' ? 'by month' : 'by day';

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      {data.schemaWarning && <p role="alert" className="rounded-control border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">{data.schemaWarning}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Payments to verify" value={na.paymentVerification} href={orders} />
        <Tile label="Ready for review" value={na.forReview} href={orders} />
        <Tile label="Revisions requested" value={na.revisionRequested} href={orders} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="New orders today" value={data.newOrders.today} />
        <Tile label="New orders, last 7 days" value={data.newOrders.last7} />
        <Tile label="Pending payments" value={data.pendingPayments.count} sub={money ? `${peso(money.pendingCentavos)} awaiting payment` : undefined} />
      </div>

      {money && (
        <Card>
          <h2 className="font-display text-lg font-bold">Money</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {([['This month', money.thisMonth], ['Last month', money.lastMonth]] as const).map(([title, m]) => (
              <dl key={title} className="text-sm">
                <dt className="font-semibold text-slate-700">{title}</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{peso(m.revenueCentavos)}</dd>
                <dd className="text-slate-700">{m.delivered} delivered · average {peso(m.averageCentavos)}</dd>
              </dl>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold">Orders by status</h2>
          <ul className="mt-3 space-y-2">
            {STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-3">
                <span className="w-48 shrink-0"><StatusPill status={s} /></span>
                <span className="h-3 flex-1 rounded bg-slate-100"><span className="block h-3 rounded bg-brand-700" style={{ width: `${(data.statusCounts[s] / max) * 100}%` }} /></span>
                <span className="w-8 text-right text-sm font-semibold">{data.statusCounts[s]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold">Recent activity</h2>
          {data.recent.length === 0 ? <p className="mt-3 text-sm text-slate-700">Nothing yet.</p> : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {data.recent.map((r, i) => (
                <li key={i} className="py-2">
                  <a href={`#/orders/${r.orderId}`} className="font-mono font-semibold text-brand-800 hover:underline">{r.reference}</a> · {r.label}
                  <div className="text-xs text-slate-600">{manila(r.at)} · {r.actor}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!c ? <p role="status" className="text-sm text-slate-700">Charts are unavailable right now.</p> : <section aria-labelledby="dash-charts" className="space-y-4">
        <h2 id="dash-charts" className="sr-only">Charts</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Chart period" className="flex flex-wrap gap-2">
            {RANGES.map(([k, label]) => (
              <Button key={k} size="sm" variant={range === k ? 'primary' : 'secondary'} aria-pressed={range === k} onClick={() => choose(k)}>{label}</Button>
            ))}
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-700">
            {loading && <Spinner />}Updated {new Date(c.asOf).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', timeStyle: 'short' })}
          </p>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><BarChart title={`Orders placed ${per}`} buckets={c.buckets} stacked series={[{ name: 'Ready-made', values: c.orders.template }, { name: 'Custom', values: c.orders.custom }]} /></Card>
          <Card><Doughnut title="Orders placed, by current status" unit="orders" slices={groupStatusMix(c.statusMix)} /></Card>
          {c.revenue && <Card><LineChart title={`Revenue ${per}`} buckets={c.buckets} series={[{ name: 'Revenue', values: c.revenue, money: true }]} /></Card>}
          {c.payments && (
            <Card>
              <Doughnut title="Payments submitted" unit="payments" slices={[
                { label: 'Confirmed', value: c.payments.confirmed, color: '#0ca30c' },
                { label: 'Waiting', value: c.payments.submitted, color: '#fab219' },
                { label: 'Rejected', value: c.payments.rejected, color: '#d03b3b' },
              ]} />
            </Card>
          )}
          {c.topDesigns && <Card><HBarChart title="Top designs" unit="paid orders" rows={c.topDesigns.map((d) => ({ label: d.name, value: d.paidOrders }))} /></Card>}
        </div>
      </section>}
    </section>
  );
}
