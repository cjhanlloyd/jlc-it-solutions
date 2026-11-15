// One customer: editable contact details, orders, payments, inquiries and an activity timeline (Manila time).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { STATUS_LABEL, type OrderStatus } from '../../shared/order-status';
import { peso } from '../invitations/kit';
import { Button, Card, Spinner, StatusPill, TextArea, TextField } from '../ui';
import { fmtManila, type Session } from './api';

type Detail = {
  customer: { id: number; email: string; name: string; phone: string | null; notes: string | null; created_at: string };
  orders: { id: number; reference: string; status: string; packageName: string; amountCentavos: number; createdAt: string }[];
  payments: { orderReference: string; status: string; amountCentavos: number; submittedAt: string }[];
  inquiries: { id: string; status: string; createdAt: string; serviceRequired: string }[];
  activity: { type: string; at: string; orderReference?: string; actor?: string; kind?: string; from?: string | null; to?: string | null; note?: string | null; id?: string; status?: string; serviceRequired?: string; subject?: string; emailType?: string }[];
};
const label = (s: string | null | undefined) => (s ? STATUS_LABEL[s as OrderStatus] ?? s : '');

function describe(a: Detail['activity'][number]) {
  if (a.type === 'order_event') return `Order ${a.orderReference}: ${a.kind === 'status' ? `${label(a.from) || 'Created'} → ${label(a.to)}` : a.kind}${a.note ? ` · ${a.note}` : ''}${a.actor ? ` (${a.actor})` : ''}`;
  if (a.type === 'inquiry') return `Inquiry received: ${a.serviceRequired} (${a.status})`;
  return `Email sent: ${a.subject}`;
}

export default function CustomerDetail({ session, id }: { session: Session; id: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const url = `/api/admin/customers/${id}`;

  const load = useCallback(() => session.api<Detail>(url).then((d) => {
    setData(d);
    setForm({ name: d.customer.name ?? '', phone: d.customer.phone ?? '', notes: d.customer.notes ?? '' });
  }, (e: Error) => setLoadError(e.message)), [session, url]);
  useEffect(() => { load(); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await session.api(url, form);
      setNotice('Saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loadError && !data) return <p role="alert" className="text-sm font-medium text-red-700">{loadError} <a href="#/customers" className="underline">Back to customers</a></p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading customer…</p>;
  const { customer, orders, payments, inquiries, activity } = data;
  const th = 'px-4 py-3';

  return (
    <div className="space-y-5">
      <a href="#/customers" className="text-sm font-semibold text-brand-800 hover:underline">← Customers</a>

      <Card>
        <h1 className="font-display text-2xl font-bold">{customer.name || customer.email}</h1>
        <p className="mt-1 text-sm text-slate-600">{customer.email} · customer since {fmtManila(customer.created_at)}</p>
        <form className="mt-4 space-y-3" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Phone" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <TextArea label="Notes" rows={4} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} hint={`${form.notes.length}/2000`} />
          <div aria-live="polite">
            {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          </div>
          <Button type="submit" loading={busy} disabled={busy}>Save</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Orders</h2>
        {orders.length === 0 ? <p className="mt-2 text-sm text-slate-600">No orders yet.</p> : (
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className={th}>Reference</th><th className={th}>Package</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Created</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono font-semibold"><a href={`#/orders/${o.id}`} className="text-brand-800 hover:underline">{o.reference}</a></td>
                  <td className="px-4 py-3">{o.packageName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{peso(o.amountCentavos)}</td>
                  <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtManila(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Payments</h2>
        {payments.length === 0 ? <p className="mt-2 text-sm text-slate-600">No payments yet.</p> : (
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className={th}>Order</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Submitted</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-mono">{p.orderReference}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{peso(p.amountCentavos)}</td>
                  <td className="px-4 py-3 capitalize">{p.status}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtManila(p.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Inquiries</h2>
        {inquiries.length === 0 ? <p className="mt-2 text-sm text-slate-600">No inquiries.</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {inquiries.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <a href={`#/inquiries/${encodeURIComponent(i.id)}`} className="font-semibold text-brand-800 hover:underline">{i.serviceRequired}</a>
                <span>{i.status}</span>
                <span className="text-slate-600">{fmtManila(i.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Activity</h2>
        {activity.length === 0 ? <p className="mt-2 text-sm text-slate-600">No activity yet.</p> : (
          <ol className="mt-3 space-y-3">
            {activity.map((a, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm">
                <p className="text-xs text-slate-600">{fmtManila(a.at)}</p>
                <p className="break-words">{describe(a)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
