// Activity: the audit log with type tabs and counts, search, paging, Manila time.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState, Spinner, TextField } from '../ui';
import { fmtManila, type Session } from './api';

const TABS: [string, string][] = [
  ['all', 'All'], ['signin', 'Sign-ins'], ['failed', 'Failed sign-ins'], ['security', 'Security'], ['errors', 'Errors'],
  ['inquiries', 'Inquiries'], ['orders', 'Orders'], ['content', 'Content'], ['customers', 'Customers'],
];
type Log = { id: number; timestamp: string; logType: string; message: string };
type Res = { logs: Log[]; counts: Record<string, number>; page: number; pages: number };

export default function ActivityPage({ session }: { session: Session }) {
  const [f, setF] = useState({ type: 'all', q: '', page: 1 });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setLoading(true); setError('');
    session.api<Res>(`/api/admin/activity?${new URLSearchParams({ type: f.type, ...(f.q && { q: f.q }), page: String(f.page) })}`)
      .then((d) => { if (!stale) setData(d); })
      .catch((e: Error) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [f, session]);

  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...patch }));

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Activity</h1>
      <div role="group" aria-label="Activity type" className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={f.type === key} onClick={() => set({ type: key })}
            className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold ${f.type === key ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
            {label}{data?.counts[key] !== undefined && <span className="ml-1.5">{data.counts[key]}</span>}
          </button>
        ))}
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); set({ q: search.trim() }); }}>
        <div className="min-w-56 flex-1"><TextField label="Search" type="search" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading activity…</p>}
      {data && (data.logs.length === 0 ? <div className="mt-6"><EmptyState title="No activity here">Try another tab or clear the search.</EmptyState></div> : (
        <div className={`mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">When (Manila)</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Message</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtManila(l.timestamp)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{l.logType}</td>
                  <td className="px-4 py-3 break-words">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => setF((x) => ({ ...x, page: data.page - 1 }))}>Previous</Button>
          <span>Page {data.page} of {data.pages}</span>
          <Button variant="secondary" size="sm" disabled={data.page >= data.pages} onClick={() => setF((x) => ({ ...x, page: data.page + 1 }))}>Next</Button>
        </div>
      )}
    </section>
  );
}
