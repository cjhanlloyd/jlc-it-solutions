// Customers list: search, table with order count, total paid and last activity → #/customers/<id>.
import { useEffect, useState, type FormEvent } from 'react';
import { peso } from '../invitations/kit';
import { Button, EmptyState, Spinner, TextField } from '../ui';
import { fmtManila, type Session } from './api';

type Row = { id: number; name: string; email: string; phone: string | null; orders: number; paidCentavos: number; lastActivity: string | null };
type ListResponse = { customers: Row[]; page: number; pages: number };

let remembered = { q: '', page: 1 };

export default function CustomersPage({ session }: { session: Session }) {
  const [filters, setFilters] = useState(remembered);
  const [search, setSearch] = useState(filters.q);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    remembered = filters;
    let stale = false;
    setLoading(true);
    setError('');
    session.api<ListResponse>(`/api/admin/customers?${new URLSearchParams({ ...(filters.q && { q: filters.q }), page: String(filters.page) })}`)
      .then((d) => { if (!stale) setData(d); })
      .catch((e: Error) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [filters, session]);

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Customers</h1>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); setFilters({ q: search.trim(), page: 1 }); }}>
        <div className="min-w-56 flex-1">
          <TextField label="Search" type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading customers…</p>}
      {data && (data.customers.length === 0 ? (
        <div className="mt-6"><EmptyState title="No customers found">Customers appear after their first order or inquiry.</EmptyState></div>
      ) : (
        <div className={`mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Total paid</th><th className="px-4 py-3">Last activity</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.customers.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { window.location.hash = `#/customers/${c.id}`; }}>
                  <td className="px-4 py-3"><a href={`#/customers/${c.id}`} className="font-semibold text-brand-800 hover:underline">{c.name || '—'}</a></td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.phone || '—'}</td>
                  <td className="px-4 py-3">{c.orders}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{peso(c.paidCentavos)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtManila(c.lastActivity)}</td>
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
