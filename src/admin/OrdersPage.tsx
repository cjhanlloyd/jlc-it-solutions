// Orders list: status tabs with counts, search, assigned filter, table → #/orders/<id>.
import { useEffect, useState, type FormEvent } from 'react';
import { STATUSES, STATUS_LABEL, type OrderStatus } from '../../shared/order-status';
import { peso } from '../invitations/kit';
import { Button, EmptyState, Select, Spinner, StatusPill, TextField } from '../ui';
import { fmtDate, type Session } from './api';

const NEEDS_ACTION: OrderStatus[] = ['payment_verification', 'for_review', 'revision_requested'];
type Tab = 'needs' | 'all' | OrderStatus;
type Row = { id: number; reference: string; status: string; title: string; designName: string; customerName: string; email?: string; amountCentavos: number; createdAt: string; assignedTo: string | null };
type ListResponse = { orders: Row[]; counts: Record<OrderStatus, number>; page: number; pages: number };

// Filters survive a trip to an order and back
let remembered = { tab: 'needs' as Tab, q: '', assigned: '', page: 1 };

export default function OrdersPage({ session }: { session: Session }) {
  const [filters, setFilters] = useState(remembered);
  const [search, setSearch] = useState(filters.q);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    remembered = filters;
    let stale = false;
    const url = (status: string, page: number) => `/api/admin/orders?${new URLSearchParams({ ...(status && { status }), ...(filters.q && { q: filters.q }), ...(filters.assigned && { assigned: filters.assigned }), page: String(page) })}`;
    setLoading(true);
    setError('');
    // The API filters one status at a time, so "Needs action" merges three lists.
    // shortcut: only the first page (25) of each needs-action status shows; add a multi-status filter to the API if the queue grows past that.
    const load = filters.tab === 'needs'
      ? Promise.all(NEEDS_ACTION.map((s) => session.api<ListResponse>(url(s, 1)))).then((all) => ({
        ...all[0], page: 1, pages: 1, orders: all.flatMap((r) => r.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      : session.api<ListResponse>(url(filters.tab === 'all' ? '' : filters.tab, filters.page));
    load.then((d) => { if (!stale) setData(d); })
      .catch((e: Error) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [filters, session]);

  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const counts = data?.counts;
  const total = counts ? STATUSES.reduce((a, s) => a + counts[s], 0) : 0;
  const tabs: [Tab, string, number | undefined][] = [
    ['needs', 'Needs action', counts && NEEDS_ACTION.reduce((a, s) => a + counts[s], 0)],
    ['all', 'All', counts && total],
    ...STATUSES.map((s): [Tab, string, number | undefined] => [s, STATUS_LABEL[s], counts?.[s]]),
  ];

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Orders</h1>
      <div role="tablist" aria-label="Order status" className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={filters.tab === key} onClick={() => set({ tab: key })}
            className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold ${filters.tab === key ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
            {label}{n !== undefined && <span className="ml-1.5 opacity-80">{n}</span>}
          </button>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); set({ q: search.trim() }); }}>
        <div className="min-w-56 flex-1">
          <TextField label="Search" type="search" placeholder="Reference, name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-44">
          <Select label="Assigned" value={filters.assigned} onChange={(e) => set({ assigned: e.target.value })}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Unassigned</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading orders…</p>}
      {data && (data.orders.length === 0 ? (
        <div className="mt-6"><EmptyState title="No orders here">Try another tab or clear the search.</EmptyState></div>
      ) : (
        <div className={`mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Assigned</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { window.location.hash = `#/orders/${o.id}`; }}>
                  <td className="px-4 py-3 font-mono font-semibold"><a href={`#/orders/${o.id}`} className="text-brand-800 hover:underline">{o.reference}</a></td>
                  <td className="px-4 py-3">{o.title || '—'}<div className="text-xs text-slate-500">{o.designName}</div></td>
                  <td className="px-4 py-3">{o.customerName || '—'}{o.email && <div className="text-xs text-slate-500">{o.email}</div>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{peso(o.amountCentavos)}</td>
                  <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{o.assignedTo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: data.page - 1 }))}>Previous</Button>
          <span>Page {data.page} of {data.pages}</span>
          <Button variant="secondary" size="sm" disabled={data.page >= data.pages} onClick={() => setFilters((f) => ({ ...f, page: data.page + 1 }))}>Next</Button>
        </div>
      )}
    </section>
  );
}
