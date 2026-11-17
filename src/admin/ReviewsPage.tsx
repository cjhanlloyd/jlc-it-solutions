// Reviews (#/reviews): moderate customer reviews. Tabs Pending / Approved / Rejected / All; approve, reject with a reason, delete.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, EmptyState, Spinner, TextArea } from '../ui';
import type { Session } from './api';
import { Stars } from '../site/Stars';

type Review = {
  id: number; displayName: string; rating: number; body: string; status: 'pending' | 'approved' | 'rejected'; rejectReason: string | null;
  customerEmail: string; createdAt: string; updatedAt: string; moderatedAt: string | null; moderatedBy: string | null;
};
const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']] as const;
const PILL = { pending: 'bg-amber-100 text-amber-900', approved: 'bg-emerald-100 text-emerald-900', rejected: 'bg-red-100 text-red-900' };
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export default function ReviewsPage({ session }: { session: Session }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('pending');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const load = () => session.api<{ reviews: Review[]; pendingCount: number }>(`/api/admin/reviews?status=${tab}`)
    .then((d) => { setReviews(d.reviews); setPending(d.pendingCount); }).catch((e: Error) => setError(e.message));
  useEffect(() => { setReviews(null); setRejecting(null); load(); }, [session, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(body: unknown): Promise<boolean> {
    setBusy(true); setError('');
    try { await session.api('/api/admin/reviews', body); await load(); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  async function reject(e: FormEvent, id: number) {
    e.preventDefault();
    if (await run({ action: 'reject', id, reason: reason.trim() })) { setRejecting(null); setReason(''); }
  }

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Reviews{pending > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900">{pending} pending</span>}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-700">Customers with a delivered invitation can leave one review. It shows on the website only after you approve it. Editing a review sends it back here.</p>
      <div role="tablist" aria-label="Review status" className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-control px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${tab === k ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!reviews && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading reviews…</p>}
      {reviews && (reviews.length === 0 ? (
        <div className="mt-6"><EmptyState title="No reviews here">Nothing to show for this filter.</EmptyState></div>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((r) => (
            <li key={r.id}><Card>
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={r.rating} className="h-5 w-5" />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[r.status]}`}>{r.status[0].toUpperCase() + r.status.slice(1)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-900">{r.body}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-slate-600">Name shown: </dt><dd className="inline break-words font-semibold">{r.displayName}</dd></div>
                <div><dt className="inline text-slate-600">Customer: </dt><dd className="inline break-all">{r.customerEmail}</dd></div>
                <div><dt className="inline text-slate-600">Written: </dt><dd className="inline">{when(r.createdAt)}</dd></div>
                <div><dt className="inline text-slate-600">Last changed: </dt><dd className="inline">{when(r.updatedAt)}</dd></div>
                {r.moderatedAt && <div><dt className="inline text-slate-600">Checked: </dt><dd className="inline break-all">{when(r.moderatedAt)}{r.moderatedBy ? ` by ${r.moderatedBy}` : ''}</dd></div>}
                {r.rejectReason && <div><dt className="inline text-slate-600">Reason: </dt><dd className="inline break-words">{r.rejectReason}</dd></div>}
              </dl>
              {rejecting === r.id ? (
                <form onSubmit={(e) => reject(e, r.id)} className="mt-4 max-w-lg space-y-3">
                  <TextArea label="Reason (optional, shown to the customer)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" loading={busy}>Reject review</Button>
                    <Button variant="secondary" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status !== 'approved' && <Button size="sm" disabled={busy} onClick={() => run({ action: 'approve', id: r.id })}>Approve</Button>}
                  {r.status !== 'rejected' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setRejecting(r.id); setReason(''); }}>Reject</Button>}
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (confirm('Delete this review? This cannot be undone.')) run({ action: 'delete', id: r.id }); }}>Delete</Button>
                </div>
              )}
            </Card></li>
          ))}
        </ul>
      ))}
    </section>
  );
}
