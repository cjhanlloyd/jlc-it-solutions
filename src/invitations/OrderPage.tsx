// /order/<REF>#<token>: order status, GCash payment instructions and receipt upload.
// The emailed tracking token arrives in the hash once; it (or a /track view token) lives in sessionStorage per reference.
import React from 'react';
import * as Icons from 'lucide-react';
import { Button, Card, Spinner, StatusPill, TextField } from '../ui';
import { optimizeImage } from '../components/admin/images';
import { LIMITS } from '../../shared/invitation-fields';
import { Alert, peso } from './kit';
import { timeLeft } from './countdown';
import { LookupForm, orderKey } from './TrackPage';

type Order = {
  reference: string; status: string; statusLabel: string; message: string; title: string; designName: string;
  amountCentavos: number; deadline: string | null; createdAt: string;
  events: { at: string; label: string; note: string | null }[];
  payment: { method: string; accountName: string; accountNumber: string; instructions: string; qrUrl: string; amountCentavos: number; reference: string; deadline: string | null } | null;
  lastRejection: string | null; guestUrl?: string;
};

function takeToken(reference: string): string {
  let fromHash = '';
  try { fromHash = decodeURIComponent(window.location.hash.slice(1)); } catch { /* malformed hash: treat as no token */ }
  if (fromHash) {
    try { sessionStorage.setItem(orderKey(reference), fromHash); } catch { /* private mode: token kept in memory only */ }
    window.history.replaceState(null, '', window.location.pathname);
    return fromHash;
  }
  try { return sessionStorage.getItem(orderKey(reference)) || ''; } catch { return ''; }
}

const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export default function OrderPage({ reference }: { reference: string }) {
  const [token, setToken] = React.useState(() => takeToken(reference));
  const [order, setOrder] = React.useState<Order | null | 'missing' | 'offline'>(null);
  const [now, setNow] = React.useState(Date.now());
  // Kept here, not in PaymentCard: a 409 usually means the reload drops the payment card.
  const [notice, setNotice] = React.useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    return fetch(`/api/orders/${encodeURIComponent(reference)}`, { headers: { 'X-Order-Token': token } })
      .then(async (res) => {
        if (res.status === 404) {
          try { sessionStorage.removeItem(orderKey(reference)); } catch { /* private mode */ }
          return setOrder('missing');
        }
        if (!res.ok) return setOrder('offline');
        setOrder(await res.json());
        setNow(Date.now());
      })
      .catch(() => setOrder('offline'));
  }, [reference, token]);

  React.useEffect(() => { load(); }, [load]);

  const pending = typeof order === 'object' && order?.status === 'pending_payment' ? order : null;
  React.useEffect(() => {
    if (!pending?.deadline) return;
    const id = setInterval(() => {
      setNow(Date.now());
      // The server cancels overdue orders when they are read, so reload once the deadline passes.
      if (!timeLeft(pending.deadline, Date.now())) load();
    }, 30_000);
    return () => clearInterval(id);
  }, [pending?.deadline, load]);

  if (!token || order === 'missing') {
    return (
      <div className="bg-slate-50 py-12 px-4 select-text">
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Find your order</h1>
          <p className="text-sm text-slate-600">
            {order === 'missing' ? 'This link has expired or is not valid on this device. ' : ''}
            Enter the email address you ordered with to see order {reference}.
          </p>
          <Card><LookupForm reference={reference} onFound={(t) => { setOrder(null); setToken(t); }} /></Card>
        </div>
      </div>
    );
  }
  if (order === null) return <div className="py-24 flex justify-center text-slate-500"><Spinner className="h-6 w-6" /></div>;
  if (order === 'offline') {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <p className="text-slate-700">We could not load your order. Please check your connection and try again.</p>
        <Button variant="secondary" onClick={() => { setOrder(null); load(); }}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-10 px-4 select-text">
      <div className="max-w-2xl mx-auto space-y-5">
        {notice && <Alert>{notice}</Alert>}
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 font-display">Your order</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="text-sm text-slate-700">{order.message}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Reference</dt>
            <dd className="flex items-center gap-2 font-mono font-semibold text-slate-900"><span>{order.reference}</span><CopyButton text={order.reference} label="Copy reference" /></dd>
            <dt className="text-slate-500">Amount</dt>
            <dd className="font-semibold text-slate-900">{peso(order.amountCentavos)}</dd>
            {order.designName && <><dt className="text-slate-500">Design</dt><dd className="text-slate-900 break-words">{order.designName}</dd></>}
            {order.title && <><dt className="text-slate-500">Invitation</dt><dd className="text-slate-900 break-words">{order.title}</dd></>}
          </dl>
        </Card>

        {order.payment && <PaymentCard order={order} payment={order.payment} token={token} now={now} reload={load} setNotice={setNotice} />}

        {order.status === 'delivered' && (
          <Card className="space-y-3">
            {order.guestUrl && (
              <a href={order.guestUrl} target="_blank" rel="noopener"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-control bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
                Open your invitation <Icons.ExternalLink className="h-4 w-4" />
              </a>
            )}
            <p className="text-sm text-slate-600">Your private manage link was emailed to you.</p>
          </Card>
        )}

        {order.events.length > 0 && (
          <Card>
            <h2 className="text-sm font-extrabold text-slate-900 font-display mb-3">Timeline</h2>
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {order.events.map((e, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-slate-900">{e.label}</p>
                  <p className="text-xs text-slate-500">{when(e.at)}</p>
                  {e.note && <p className="text-slate-700 break-words">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button type="button" aria-label={label} title={label} className="p-1 rounded text-slate-500 hover:text-slate-900 cursor-pointer"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
      {copied ? <Icons.Check className="h-4 w-4" /> : <Icons.Copy className="h-4 w-4" />}
    </button>
  );
}

function PaymentCard({ order, payment, token, now, reload, setNotice }: {
  order: Order; payment: NonNullable<Order['payment']>; token: string; now: number; reload: () => Promise<void>; setNotice: (msg: string) => void;
}) {
  const [image, setImage] = React.useState('');
  const [customerReference, setCustomerReference] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const left = timeLeft(payment.deadline, now);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError('');
    try { setImage(await optimizeImage(file, 1600, 2400, 0.85)); } catch { setError('We could not read that image. Please use a JPEG or PNG screenshot.'); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return setError('Please choose a screenshot of your GCash receipt.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.reference)}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Order-Token': token },
        body: JSON.stringify({ image, customerReference: customerReference.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 409) {
        setNotice(res.ok ? '' : data.error || 'This order is no longer waiting for payment.');
        await reload();
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-extrabold text-slate-900 font-display">Pay with GCash</h2>
      {order.lastRejection && <Alert>Your last receipt was not accepted: {order.lastRejection}</Alert>}
      <div className="flex flex-col sm:flex-row gap-4">
        <img src={payment.qrUrl} alt="GCash QR code" className="w-full max-w-[240px] self-center sm:self-start rounded-xl border border-slate-200 bg-white" />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm content-start">
          <dt className="text-slate-500">Account name</dt><dd className="font-semibold text-slate-900 break-words">{payment.accountName}</dd>
          <dt className="text-slate-500">GCash number</dt>
          <dd className="flex items-center gap-2 font-mono font-semibold text-slate-900"><span>{payment.accountNumber}</span><CopyButton text={payment.accountNumber} label="Copy GCash number" /></dd>
          <dt className="text-slate-500">Amount</dt><dd className="font-semibold text-slate-900">{peso(payment.amountCentavos)}</dd>
          <dt className="text-slate-500">Message</dt><dd className="font-mono text-slate-900">{payment.reference}</dd>
          {payment.deadline && <>
            <dt className="text-slate-500">Pay within</dt>
            <dd className="text-slate-900">{left ? <><span className="font-semibold">{left}</span> <span className="text-xs text-slate-500">(by {when(payment.deadline)})</span></> : 'The deadline has passed.'}</dd>
          </>}
        </dl>
      </div>
      {payment.instructions && <p className="text-sm text-slate-700 whitespace-pre-line break-words">{payment.instructions}</p>}

      <form onSubmit={submit} className="space-y-4 border-t border-slate-200 pt-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Screenshot of your GCash receipt</span>
          <input type="file" accept="image/*" className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-control file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {image && <img src={image} alt="Receipt preview" className="max-h-80 rounded-xl border border-slate-200" />}
        <TextField label="GCash reference no. (optional)" maxLength={LIMITS.paymentRef} value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} disabled={!!payment.deadline && !left} className="w-full">Submit payment confirmation</Button>
      </form>
    </Card>
  );
}
