// Inquiries list: status tabs with counts, search, newest first, table → #/inquiries/<id>.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState, Spinner, TextField } from '../ui';
import { fmtManila, type Session } from './api';

export const INQUIRY_STATUSES = ['New', 'In Progress', 'Replied', 'Converted', 'Closed'];
type Row = { id: string; fullName: string; companyName: string | null; email: string; phone: string | null; serviceRequired: string; status: string; createdAt: string; isCustomRequest: boolean };
type ListResponse = { inquiries: Row[]; counts: Record<string, number>; page: number; pages: number };

// Filters survive a trip to an inquiry and back
let remembered = { status: '', q: '', page: 1 };

export default function InquiriesPage({ session }: { session: Session }) {
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
    session.api<ListResponse>(`/api/admin/inquiries?${new URLSearchParams({ ...(filters.status && { status: filters.status }), ...(filters.q && { q: filters.q }), page: String(filters.page) })}`)
      .then((d) => { if (!stale) setData(d); })
      .catch((e: Error) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [filters, session]);

  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const counts = data?.counts;
  const tabs: [string, string, number | undefined][] = [
    ['', 'All', counts && (Object.values(counts) as number[]).reduce((a, n) => a + n, 0)],
    ...INQUIRY_STATUSES.map((s): [string, string, number | undefined] => [s, s, counts?.[s]]),
  ];

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Inquiries</h1>
      <div role="group" aria-label="Inquiry status" className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map(([key, label, n]) => (
          <button key={key || 'all'} type="button" aria-pressed={filters.status === key} onClick={() => set({ status: key })}
            className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold ${filters.status === key ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
            {label}{n !== undefined && <span className="ml-1.5">{n}</span>}
          </button>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); set({ q: search.trim() }); }}>
        <div className="min-w-56 flex-1">
          <TextField label="Search" type="search" placeholder="Name, email, company or service" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading inquiries…</p>}
      {data && (data.inquiries.length === 0 ? (
        <div className="mt-6"><EmptyState title="No inquiries here">Try another tab or clear the search.</EmptyState></div>
      ) : (
        <div className={`mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">From</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Received</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.inquiries.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { window.location.hash = `#/inquiries/${encodeURIComponent(i.id)}`; }}>
                  <td className="px-4 py-3"><a href={`#/inquiries/${encodeURIComponent(i.id)}`} className="font-semibold text-brand-800 hover:underline">{i.fullName}</a>
                    <div className="text-xs text-slate-600">{i.email}</div></td>
                  <td className="px-4 py-3">{i.serviceRequired}{i.isCustomRequest && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-900">Custom request</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{i.status}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtManila(i.createdAt)}</td>
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
