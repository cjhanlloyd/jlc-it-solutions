// One order: header, receipts with Approve/Reject, invitation preview, actions, assignment, notes and timeline.
// Buttons follow server/permissions; the server enforces every action again.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { can } from '../../server/permissions';
import { LIMITS } from '../../shared/invitation-fields';
import { STATUS_LABEL, type OrderStatus } from '../../shared/order-status';
import { peso, photoSrc, useInvitationFonts } from '../invitations/kit';
import { Button, Card, Spinner, StatusPill, TextArea, TextField } from '../ui';
import { fmtDate, type Session } from './api';

const InvitationView = lazy(() => import('../invitations/InvitationView'));

type Payment = { id: number; status: string; amountCentavos: number; customerReference: string | null; submittedAt: string; verifiedBy: string | null; verifiedAt: string | null; adminReference: string | null; note: string | null; receiptUrl?: string };
type Detail = {
  order: { id: number; reference: string; status: OrderStatus; title: string; designName: string; amountCentavos: number; createdAt: string; paymentDeadline: string | null; deliveredAt: string | null; assignedTo: string | null };
  customer: { name: string; email?: string; phone?: string };
  invitation: { slug: string; status: string; layoutKey: string; colorScheme: any; details: any; photos: string[] } | null;
  payments: Payment[];
  events: { at: string; actor: string; kind: string; from: string | null; to: string | null; note: string | null; visible: boolean }[];
  allowedNext: OrderStatus[];
};
// Moves made with the `status` action; delivered/refunded/payment moves have their own controls
const STATUS_MOVES: OrderStatus[] = ['in_production', 'for_review', 'revision_requested', 'completed', 'cancelled'];
const label = (s: string | null) => (s ? STATUS_LABEL[s as OrderStatus] ?? s : '');

// Fetched with the bearer token; the site CSP blocks blob: URLs, so it arrives as a data: URL (nothing to revoke).
function Receipt({ session, url }: { session: Session; url: string }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let stale = false;
    session.image(url).then((s) => { if (!stale) setSrc(s); }, (e: Error) => { if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [session, url]);
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!src) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading receipt…</p>;
  return (
    <div>
      <img src={src} alt="GCash receipt" className={`${expanded ? '' : 'max-h-[32rem] '}w-auto max-w-full rounded-control border border-slate-200`} />
      <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-semibold text-brand-800 underline">{expanded ? 'Shrink' : 'Expand'}</button>
    </div>
  );
}

type Confirm = { kind: 'reject'; paymentId: number } | { kind: 'refund' } | { kind: 'cancel' };

export default function OrderDetail({ session, id }: { session: Session; id: number }) {
  useInvitationFonts();
  const role = session.user.role;
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [adminRef, setAdminRef] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => session.api<Detail>(`/api/admin/orders/${id}`).then(setData, (e: Error) => setLoadError(e.message)), [session, id]);
  useEffect(() => { load(); }, [load]);

  // Every action re-fetches the order, success or not, so the page shows what the server now has
  async function run(body: Record<string, unknown>, done?: (r: any) => string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await session.api(`/api/admin/orders/${id}`, body);
      setNotice(done ? done(r) : 'Saved.');
      setConfirm(null);
      setConfirmText('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      await load();
      setBusy(false);
    }
  }

  if (loadError && !data) return <p role="alert" className="text-sm font-medium text-red-700">{loadError} <a href="#/orders" className="underline">Back to orders</a></p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading order…</p>;
  const { order, customer, invitation, payments, events, allowedNext } = data;
  const guestLink = invitation && `${window.location.origin}/i/${invitation.slug}`;
  const reviewable = order.status === 'payment_verification' && can(role, 'payments.review');
  const moves = STATUS_MOVES.filter((s) => allowedNext.includes(s));

  function submitConfirm() {
    if (!confirm) return;
    const text = confirmText.trim();
    if (confirm.kind === 'reject') run({ action: 'reject', paymentId: confirm.paymentId, reason: text }, () => 'Payment rejected; the customer was asked for a new receipt.');
    else if (confirm.kind === 'refund') run({ action: 'refund', ...(text && { note: text }) }, () => 'Order refunded.');
    else run({ action: 'status', to: 'cancelled', ...(text && { note: text }) }, () => 'Order cancelled.');
  }

  return (
    <div className="space-y-5">
      <a href="#/orders" className="text-sm font-semibold text-brand-800 hover:underline">← Orders</a>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{order.reference}</h1>
          <StatusPill status={order.status} />
          <span className="ml-auto text-xl font-semibold">{peso(order.amountCentavos)}</span>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="inline text-slate-500">Order: </dt><dd className="inline">{order.title || '—'} · {order.designName}</dd></div>
          <div><dt className="inline text-slate-500">Customer: </dt><dd className="inline">{[customer.name, customer.email, customer.phone].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt className="inline text-slate-500">Created: </dt><dd className="inline">{fmtDate(order.createdAt)}</dd></div>
          <div><dt className="inline text-slate-500">Payment deadline: </dt><dd className="inline">{fmtDate(order.paymentDeadline)}</dd></div>
          {order.deliveredAt && <div><dt className="inline text-slate-500">Delivered: </dt><dd className="inline">{fmtDate(order.deliveredAt)}</dd></div>}
          {order.status === 'delivered' && guestLink && <div className="sm:col-span-2"><dt className="inline text-slate-500">Guest link: </dt><dd className="inline"><a href={guestLink} target="_blank" rel="noreferrer" className="break-all text-brand-800 underline">{guestLink}</a></dd></div>}
        </dl>
      </Card>

      <div aria-live="polite">
        {notice && <p className="rounded-control bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
        {error && <p role="alert" className="rounded-control bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
      </div>

      {confirm && (
        <Card className="border-red-200">
          <h2 className="font-display text-lg font-semibold">{confirm.kind === 'reject' ? 'Reject this payment?' : confirm.kind === 'refund' ? 'Refund this order?' : 'Cancel this order?'}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {confirm.kind === 'reject' ? 'The order goes back to Pending Payment and the customer is emailed the reason.'
              : confirm.kind === 'refund' ? 'The invitation goes offline. Refund the customer in GCash first. This cannot be undone.'
                : 'The customer is emailed and the order cannot be reopened.'}
          </p>
          <div className="mt-3">
            <TextArea label={confirm.kind === 'reject' ? 'Reason (shown to the customer)' : 'Note (shown to the customer)'} rows={3} required={confirm.kind === 'reject'}
              maxLength={confirm.kind === 'reject' ? LIMITS.rejectReason : 1000} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} disabled={confirm.kind === 'reject' && !confirmText.trim()} onClick={submitConfirm}>
              {confirm.kind === 'reject' ? 'Reject payment' : confirm.kind === 'refund' ? 'Confirm refund' : 'Cancel order'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setConfirm(null); setConfirmText(''); }}>Go back</Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-display text-lg font-semibold">GCash payments</h2>
        {payments.length === 0 ? <p className="mt-2 text-sm text-slate-600">No receipt uploaded yet.</p> : (
          <ul className="mt-3 space-y-5">
            {[...payments].reverse().map((p) => (
              <li key={p.id} className="space-y-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <p className="text-sm">
                  <span className="font-semibold capitalize">{p.status}</span> · {peso(p.amountCentavos)} · submitted {fmtDate(p.submittedAt)}
                  {p.customerReference && <> · customer ref <span className="font-mono">{p.customerReference}</span></>}
                </p>
                {p.verifiedBy && <p className="text-xs text-slate-600">Reviewed by {p.verifiedBy} on {fmtDate(p.verifiedAt)}{p.adminReference && <> · ref <span className="font-mono">{p.adminReference}</span></>}{p.note && <> · {p.note}</>}</p>}
                {p.receiptUrl && <Receipt session={session} url={p.receiptUrl} />}
                {reviewable && p.status === 'submitted' && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-56"><TextField label="Admin reference (optional)" maxLength={LIMITS.paymentRef} value={adminRef} onChange={(e) => setAdminRef(e.target.value)} /></div>
                    <Button loading={busy} onClick={async () => { if (await run({ action: 'approve', paymentId: p.id, adminReference: adminRef.trim() }, () => 'Payment approved.')) setAdminRef(''); }}>Approve</Button>
                    <Button variant="danger" disabled={busy} onClick={() => { setConfirm({ kind: 'reject', paymentId: p.id }); setConfirmText(''); }}>Reject</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(moves.length > 0 || allowedNext.includes('delivered') || allowedNext.includes('refunded')) && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {moves.filter((s) => s !== 'cancelled').map((s) => (
              <Button key={s} variant="secondary" disabled={busy} onClick={() => run({ action: 'status', to: s }, () => `Moved to ${label(s)}.`)}>Move to {label(s)}</Button>
            ))}
            {allowedNext.includes('delivered') && (
              <Button disabled={busy} onClick={() => run({ action: 'deliver' }, (r) => (r.emailed ? 'Delivered; the customer was emailed the guest link.' : 'Delivered. Email is off, so send the customer the guest link yourself.'))}>Deliver</Button>
            )}
            {allowedNext.includes('refunded') && <Button variant="danger" disabled={busy} onClick={() => { setConfirm({ kind: 'refund' }); setConfirmText(''); }}>Refund</Button>}
            {moves.includes('cancelled') && <Button variant="danger" disabled={busy} onClick={() => { setConfirm({ kind: 'cancel' }); setConfirmText(''); }}>Cancel order</Button>}
          </div>
        </Card>
      )}

      {invitation && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Invitation preview</h2>
          <div className="mt-3 max-h-[40rem] overflow-y-auto rounded-control border border-slate-200">
            <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm text-slate-600"><Spinner /> Loading preview…</p>}>
              <InvitationView layoutKey={invitation.layoutKey} scheme={invitation.colorScheme} details={invitation.details} photos={invitation.photos.map(photoSrc)} />
            </Suspense>
          </div>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {can(role, 'orders.assign') && (
          <Card>
            <h2 className="font-display text-lg font-semibold">Assignment</h2>
            <p className="mt-1 text-sm text-slate-600">Assigned to {order.assignedTo || 'nobody'}.</p>
            <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'assign', email: assignTo.trim() }, () => 'Assigned.')) setAssignTo(''); }}>
              <div className="min-w-48 flex-1"><TextField label="Admin email" type="email" required value={assignTo} onChange={(e) => setAssignTo(e.target.value)} /></div>
              <Button type="submit" variant="secondary" disabled={busy}>Assign</Button>
            </form>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'assign', email: session.user.email }, () => 'Assigned to you.')}>Assign to me</Button>
              {order.assignedTo && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'assign', email: null }, () => 'Unassigned.')}>Unassign</Button>}
            </div>
          </Card>
        )}
        {can(role, 'orders.work') && (
          <Card>
            <h2 className="font-display text-lg font-semibold">Add a note</h2>
            <form className="mt-3 space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'note', body: note.trim() }, () => 'Note added.')) setNote(''); }}>
              <TextArea label="Internal note" rows={3} maxLength={1000} required value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={busy || !note.trim()}>Add note</Button>
            </form>
          </Card>
        )}
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Timeline</h2>
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm">
              <p className="text-xs text-slate-500">{fmtDate(e.at)} · {e.actor}{e.visible && ' · shown to customer'}</p>
              <p>{e.kind === 'status' ? <>{label(e.from) || 'Created'} → <span className="font-semibold">{label(e.to)}</span></> : <span className="font-semibold capitalize">{e.kind}</span>}{e.note && <> · {e.note}</>}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
