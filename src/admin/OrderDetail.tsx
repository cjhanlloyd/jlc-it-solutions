// One order: header, receipts with Approve/Reject, invitation preview, actions, assignment, notes and timeline.
// Buttons follow server/permissions; the server enforces every action again.
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { can } from '../../server/permissions';
import { LIMITS } from '../../shared/invitation-fields';
import type { InvitationStyle } from '../../shared/invitation-style';
import { isSafeLink } from '../../shared/links';
import { optimizeImage } from '../components/admin/images';
import { STATUS_LABEL, type OrderStatus } from '../../shared/order-status';
import { peso, photoSrc, useInvitationFonts } from '../invitations/kit';
import { resolveCoverIndex } from '../invitations/style-render';
import { Button, Card, Spinner, StatusPill, TextArea, TextField } from '../ui';
import { fmtDate, type Session } from './api';

const InvitationView = lazy(() => import('../invitations/InvitationView'));

type Payment = { id: number; status: string; amountCentavos: number; customerReference: string | null; submittedAt: string; verifiedBy: string | null; verifiedAt: string | null; adminReference: string | null; note: string | null; receiptUrl?: string };
type Detail = {
  order: { id: number; reference: string; status: OrderStatus; title: string; designName: string; amountCentavos?: number; promoCode?: string | null; discountCentavos?: number; packageName?: string; packageKind?: string; tier?: string; designerNotes?: string | null; createdAt: string; paymentDeadline: string | null; deliveredAt: string | null; assignedTo: string | null };
  customerId?: number | null;
  customer: { name: string; email?: string; phone?: string };
  invitation: { slug: string; status: string; layoutKey: string; colorScheme: any; style?: InvitationStyle; details: any; photos: string[] } | null;
  payments: Payment[];
  proofs?: Proof[];
  events: { at: string; actor: string; kind: string; from: string | null; to: string | null; note: string | null; visible: boolean }[];
  allowedNext: OrderStatus[];
};
// Moves made with the `status` action; delivered/refunded/payment moves have their own controls
type Proof = { id: number; round: number; kind: 'file' | 'link'; url?: string; message: string | null; createdBy: string; createdAt: string };
const manila = (s: string) => new Date(s).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const MAX_PROOF = 10_000_000;
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
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!src) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading receipt…</p>;
  return (
    <div>
      <img src={src} alt="GCash receipt" className={`${expanded ? '' : 'max-h-[32rem] '}w-auto max-w-full rounded-control border border-slate-200`} />
      <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-semibold text-brand-800 underline">{expanded ? 'Shrink' : 'Expand'}</button>
    </div>
  );
}

// A file proof arrives as a data: URL (bearer fetch); images show inline, a PDF gets a Download link.
function ProofFile({ session, orderId, proof }: { session: Session; orderId: number; proof: Proof }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let stale = false;
    session.image(`/api/admin/orders/${orderId}/proofs/${proof.id}`).then((s) => { if (!stale) setSrc(s); }, (e: Error) => { if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [session, orderId, proof.id]);
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!src) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading proof…</p>;
  if (src.startsWith('data:application/pdf')) return <a href={src} download={`proof-round-${proof.round}.pdf`} className="text-sm font-semibold text-brand-800 underline">Download PDF</a>;
  return <img src={src} alt={`Proof round ${proof.round}`} className="max-h-[32rem] w-auto max-w-full rounded-control border border-slate-200" />;
}

function ProofUploader({ busy, send }: { busy: boolean; send: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [reading, setReading] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const body: Record<string, unknown> = {};
    if (message.trim()) body.message = message.trim();
    if (mode === 'link') {
      const u = link.trim();
      if (!u.startsWith('https://') || !isSafeLink(u)) return setErr('Enter a valid link that starts with https://');
      body.url = u;
    } else {
      if (!file) return setErr('Choose a file.');
      setReading(true);
      try {
        if (file.type === 'application/pdf') {
          if (file.size > MAX_PROOF) return setErr('The PDF is over 10 MB.');
          body.file = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error()); r.readAsDataURL(file); });
        } else if (/^image\/(jpeg|png|webp)$/.test(file.type)) body.file = await optimizeImage(file, 2400, 2400, 0.9);
        else return setErr('Use a JPEG, PNG, WebP or PDF file.');
      } catch { return setErr('The file could not be read.'); } finally { setReading(false); }
    }
    if (await send({ action: 'proof', ...body })) { setFile(null); setLink(''); setMessage(''); setInputKey((k) => k + 1); }
  }
  return (
    <form className="mt-3 space-y-3" onSubmit={submit}>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={mode === 'file' ? 'primary' : 'secondary'} onClick={() => setMode('file')}>File</Button>
        <Button type="button" size="sm" variant={mode === 'link' ? 'primary' : 'secondary'} onClick={() => setMode('link')}>Link</Button>
      </div>
      {mode === 'file'
        ? <label className="block text-sm font-medium text-slate-800">Proof file (JPEG, PNG, WebP or PDF up to 10 MB)
            <input key={inputKey} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        : <TextField label="Proof link (https://)" type="url" value={link} onChange={(e) => setLink(e.target.value)} />}
      <TextArea label="Message to the customer (optional)" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} hint={`${message.length}/1000`} />
      {err && <p role="alert" className="text-sm font-medium text-red-700">{err}</p>}
      <Button type="submit" loading={busy || reading} disabled={busy || reading}>Send proof to customer</Button>
    </form>
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
  const custom = order.packageKind === 'custom';
  const canProof = custom && can(role, 'orders.work') && (order.status === 'in_production' || order.status === 'revision_requested');
  const changeRequest = order.status === 'revision_requested' ? [...events].reverse().find((e) => e.visible && e.to === 'revision_requested' && e.note) : undefined;
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
          {order.amountCentavos != null && <span className="ml-auto text-xl font-semibold">{peso(order.amountCentavos)}</span>}
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="inline text-slate-500">Order: </dt><dd className="inline">{order.title || '—'} · {order.designName}</dd></div>
          {order.promoCode && <div><dt className="inline text-slate-500">Promo code: </dt><dd className="inline font-mono">{order.promoCode}</dd></div>}
          {order.promoCode && <div><dt className="inline text-slate-500">Discount: </dt><dd className="inline">−{peso(order.discountCentavos ?? 0)}</dd></div>}
          <div><dt className="inline text-slate-500">Tier: </dt><dd className="inline">{order.tier === 'premium' ? 'Premium' : 'Standard'}</dd></div>
          <div><dt className="inline text-slate-500">Customer: </dt><dd className="inline">
            {data.customerId && customer.name && can(role, 'customers.view')
              ? <><a href={`#/customers/${data.customerId}`} className="text-brand-800 underline">{customer.name}</a>{[customer.email, customer.phone].filter(Boolean).map((s) => ` · ${s}`).join('')}</>
              : [customer.name, customer.email, customer.phone].filter(Boolean).join(' · ') || '—'}
          </dd></div>
          <div><dt className="inline text-slate-500">Created: </dt><dd className="inline">{fmtDate(order.createdAt)}</dd></div>
          <div><dt className="inline text-slate-500">Payment deadline: </dt><dd className="inline">{fmtDate(order.paymentDeadline)}</dd></div>
          {order.deliveredAt && <div><dt className="inline text-slate-500">Delivered: </dt><dd className="inline">{fmtDate(order.deliveredAt)}</dd></div>}
          {order.status === 'delivered' && guestLink && <div className="sm:col-span-2"><dt className="inline text-slate-500">Guest link: </dt><dd className="inline"><a href={guestLink} target="_blank" rel="noreferrer" className="break-all text-brand-800 underline">{guestLink}</a></dd></div>}
        </dl>
      </Card>

      {custom && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900">Custom design</span>
            <span className="text-sm font-semibold">{order.packageName}</span>
          </div>
          <h2 className="mt-3 font-display text-lg font-semibold">Designer notes</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{order.designerNotes || '—'}</p>
        </Card>
      )}

      <div aria-live="polite">
        {notice && <p role="status" className="rounded-control bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
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

      {/* Payments are admin-only; the API sends none to other roles */}
      {can(role, 'payments.review') && <Card>
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
      </Card>}

      {custom && (canProof || (data.proofs?.length ?? 0) > 0) && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Design proofs</h2>
          {changeRequest && (
            <div className="mt-3 rounded-control bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Customer asked for changes ({manila(changeRequest.at)})</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{changeRequest.note}</p>
            </div>
          )}
          {canProof && <ProofUploader busy={busy} send={(b) => run(b, () => 'Proof sent to the customer.')} />}
          {(data.proofs?.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-4">
              {[...data.proofs!].reverse().map((p) => (
                <li key={p.id} className="space-y-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <p className="text-sm"><span className="font-semibold">Round {p.round}</span> · {p.createdBy} · {manila(p.createdAt)}</p>
                  {p.message && <p className="whitespace-pre-wrap break-words text-sm">{p.message}</p>}
                  {p.kind === 'link' && p.url
                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-brand-800 underline">Open link</a>
                    : <ProofFile session={session} orderId={id} proof={p} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

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
              <InvitationView layoutKey={invitation.layoutKey} scheme={invitation.colorScheme} details={invitation.details} photos={invitation.photos.map(photoSrc)} style={resolveCoverIndex(invitation.style ?? {}, invitation.photos)} />
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
