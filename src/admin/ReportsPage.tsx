// Reports (#/reports): sales, monthly revenue, payments, orders, popular designs and inquiries for a Manila date range, plus CSV exports.
import { useEffect, useState, type ReactNode } from 'react';
import { peso } from '../invitations/kit';
import { Button, Card, Spinner, TextField } from '../ui';
import type { Session } from './api';
import { displayLabel } from './displayLabel';

type Money = { count: number; centavos: number };
type Count = { count: number };
type Data = {
  range: { from: string; to: string };
  sales: { revenueCentavos: number; paidOrders: number; averageCentavos: number; refunds: Money; awaitingCentavos: number };
  monthly: { month: string; revenueCentavos: number; paidOrders: number }[];
  payments: { confirmed: Money; submitted: Money; rejected: Money; medianConfirmHours: number | null };
  orders: {
    byStatus: { status: string; label: string; count: number }[];
    funnel: { placed: number; paid: number; delivered: number };
    medianDeliveryHours: { template: number | null; custom: number | null };
  };
  designs: { designId: number | null; name: string; paidOrders: number; revenueCentavos: number; packages: { name: string; count: number }[] }[];
  inquiries: { total: number; custom: number; byStatus: ({ status: string } & Count)[]; byService: ({ service: string } & Count)[]; convertedShare: number };
};

const RANGE_KEY = 'jlc_reports_range';
const ymd = (d: Date) => d.toISOString().slice(0, 10);
// Manila "today" on the client, independent of the browser's own time zone
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const monthStart = (t: string, offset = 0) => ymd(new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + offset, 1)));
const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'This month', range: () => [monthStart(today()), today()] },
  { label: 'Last month', range: () => { const t = today(); return [monthStart(t, -1), ymd(new Date(Date.parse(monthStart(t)) - 86400_000))]; } },
  { label: 'Last 30 days', range: () => [ymd(new Date(Date.parse(today()) - 29 * 86400_000)), today()] },
  { label: 'This year', range: () => [`${today().slice(0, 4)}-01-01`, today()] },
];

function savedRange(): [string, string] {
  try {
    const r = JSON.parse(localStorage.getItem(RANGE_KEY) || 'null');
    if (typeof r?.[0] === 'string' && typeof r?.[1] === 'string') return [r[0], r[1]];
  } catch { /* fall through to the default */ }
  return PRESETS[0].range();
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-PH', { timeZone: 'UTC', month: 'short', year: 'numeric' });
const hoursText = (h: number | null) => (h === null ? 'Not enough data' : h > 48 ? `about ${Math.round(h / 24)} days` : `about ${Math.round(h)} h`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="h-full">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-700">{sub}</p>}
    </Card>
  );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 text-slate-800 sm:w-44">{r.label}</span>
          <span className="h-3 flex-1 rounded bg-slate-100"><span className="block h-3 rounded bg-brand-700" style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="w-8 text-right font-semibold">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthlyChart({ monthly }: { monthly: Data['monthly'] }) {
  const max = Math.max(1, ...monthly.map((m) => m.revenueCentavos));
  const W = 40, H = 120;
  return (
    <>
      <div className="mt-3 overflow-x-auto">
        <svg role="img" aria-label="Revenue by month (full months)" viewBox={`0 0 ${monthly.length * W} ${H}`} className="h-40" style={{ minWidth: monthly.length * 28 }} preserveAspectRatio="none">
          {monthly.map((m, i) => {
            const h = (m.revenueCentavos / max) * H;
            return <rect key={m.month} x={i * W + 6} y={H - h} width={W - 12} height={h} className="fill-brand-700"><title>{`${monthLabel(m.month)}: ${peso(m.revenueCentavos)}, ${m.paidOrders} paid orders`}</title></rect>;
          })}
        </svg>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-700"><tr><th scope="col" className="py-1 pr-4">Month</th><th scope="col" className="py-1 pr-4 text-right">Revenue</th><th scope="col" className="py-1 text-right">Paid orders</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {monthly.map((m) => <tr key={m.month}><td className="py-1 pr-4">{monthLabel(m.month)}</td><td className="py-1 pr-4 text-right">{peso(m.revenueCentavos)}</td><td className="py-1 text-right">{m.paidOrders}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ReportsPage({ session }: { session: Session }) {
  const [range, setRange] = useState(savedRange);
  const [draft, setDraft] = useState(range);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [from, to] = range;

  useEffect(() => {
    let stale = false;
    setError('');
    setLoading(true);
    session.api<Data>(`/api/admin/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((d) => {
        if (stale) return;
        setData(d);
        setLoading(false);
        // Remember the range only once it has loaded.
        try { localStorage.setItem(RANGE_KEY, JSON.stringify([from, to])); } catch { /* storage unavailable: the range just isn't remembered */ }
      })
      .catch((e: Error) => { if (!stale) { setData(null); setError(e.message); setLoading(false); } });
    return () => { stale = true; };
  }, [session, from, to]);

  function apply(r: [string, string]) {
    setRange(r);
    setDraft(r);
  }

  async function exportCsv(kind: string) {
    setExportError('');
    setExporting(true);
    try {
      const href = await session.image(`/api/admin/reports/export/${kind}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${kind}-${from}-to-${to}.csv`;
      a.click();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'The export could not be downloaded.');
    } finally { setExporting(false); }
  }

  const h2 = 'font-display text-lg font-bold';
  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Reports</h1>
      <Card>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <Button key={p.label} size="sm" variant="secondary" onClick={() => apply(p.range())}>{p.label}</Button>)}
        </div>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); apply(draft); }}>
          <TextField label="From" type="date" value={draft[0]} onChange={(e) => setDraft([e.target.value, draft[1]])} />
          <TextField label="To" type="date" value={draft[1]} onChange={(e) => setDraft([draft[0], e.target.value])} />
          <Button type="submit" size="sm">Show report</Button>
        </form>
        <p className="mt-3 text-sm text-slate-700">Showing {from} to {to} (Manila time).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['orders', 'payments', 'inquiries'] as const).map((k) => <Button key={k} size="sm" variant="secondary" disabled={exporting} onClick={() => exportCsv(k)}>{exporting ? 'Exporting…' : `Export ${k} (CSV)`}</Button>)}
        </div>
        {exportError && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{exportError}</p>}
      </Card>

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      {!error && !data && <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading report…</p>}
      {!error && data && loading && <p role="status" className="text-sm text-slate-700">Updating…</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Tile label="Revenue" value={peso(data.sales.revenueCentavos)} />
            <Tile label="Paid orders" value={data.sales.paidOrders} />
            <Tile label="Average order" value={peso(data.sales.averageCentavos)} />
            <Tile label="Refunds" value={peso(data.sales.refunds.centavos)} sub={`${data.sales.refunds.count} refunded`} />
            <div className="sm:col-span-2 lg:col-span-1"><Tile label="Awaiting payment (now)" value={peso(data.sales.awaitingCentavos)} /></div>
          </div>

          <Card>
            <h2 className={h2}>Revenue by month (full months)</h2>
            <MonthlyChart monthly={data.monthly} />
          </Card>

          <Card>
            <h2 className={h2}>Payments</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Tile label="Confirmed" value={data.payments.confirmed.count} sub={peso(data.payments.confirmed.centavos)} />
              <Tile label="Waiting to be checked" value={data.payments.submitted.count} sub={peso(data.payments.submitted.centavos)} />
              <Tile label="Rejected" value={data.payments.rejected.count} sub={peso(data.payments.rejected.centavos)} />
            </div>
            <p className="mt-3 text-sm text-slate-700">Typical (median) time to confirm a payment: <span className="font-semibold">{hoursText(data.payments.medianConfirmHours)}</span></p>
          </Card>

          <Card>
            <h2 className={h2}>Orders</h2>
            {data.orders.funnel.placed === 0 ? <p className="mt-3 text-sm text-slate-700">No orders in this period.</p> : (
              <div className="mt-3 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">By status</h3>
                  <Bars rows={data.orders.byStatus.map((s) => ({ label: s.label, count: s.count }))} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">From order to delivery <span className="font-normal">— of orders placed in this period</span></h3>
                  <Bars rows={[{ label: 'Placed', count: data.orders.funnel.placed }, { label: 'Paid', count: data.orders.funnel.paid }, { label: 'Delivered', count: data.orders.funnel.delivered }]} />
                  <p className="mt-3 text-sm text-slate-700">Typical (median) time from payment to delivery:</p>
                  <ul className="text-sm">
                    <li>Template orders: <span className="font-semibold">{hoursText(data.orders.medianDeliveryHours.template)}</span></li>
                    <li>Custom orders: <span className="font-semibold">{hoursText(data.orders.medianDeliveryHours.custom)}</span></li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className={h2}>Popular designs</h2>
            {data.designs.length === 0 ? <p className="mt-3 text-sm text-slate-700">No paid orders in this period.</p> : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-slate-700"><tr><th scope="col" className="py-1 pr-4">Design</th><th scope="col" className="py-1 pr-4 text-right">Paid orders</th><th scope="col" className="py-1 pr-4 text-right">Revenue</th><th scope="col" className="py-1">Packages</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.designs.map((d) => (
                      <tr key={d.designId ?? 'none'}>
                        <td className="py-1 pr-4">{d.name}</td>
                        <td className="py-1 pr-4 text-right">{d.paidOrders}</td>
                        <td className="py-1 pr-4 text-right">{peso(d.revenueCentavos)}</td>
                        <td className="py-1">{d.packages.map((p) => `${p.name} (${p.count})`).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className={h2}>Inquiries</h2>
            {data.inquiries.total === 0 ? <p className="mt-3 text-sm text-slate-700">No inquiries in this period.</p> : (
              <>
                <p className="mt-3 text-sm text-slate-700">{data.inquiries.total} received, {data.inquiries.custom} custom package requests. Became orders: <span className="font-semibold">{pct(data.inquiries.convertedShare)}</span></p>
                <div className="mt-3 grid gap-6 lg:grid-cols-2">
                  <div><h3 className="text-sm font-semibold text-slate-700">By status</h3><Bars rows={data.inquiries.byStatus.map((s) => ({ label: displayLabel(s.status), count: s.count }))} /></div>
                  <div><h3 className="text-sm font-semibold text-slate-700">By service</h3><Bars rows={data.inquiries.byService.map((s) => ({ label: displayLabel(s.service), count: s.count }))} /></div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
