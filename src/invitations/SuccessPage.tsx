// /invitations/success#<orderId>.<token>: PayMongo returns here. Never trust the redirect; poll until the order is paid.
import React from 'react';
import * as Icons from 'lucide-react';
import { Link } from './kit';
import { DRAFT_KEY } from './CustomiserPage';

// Read once and drop the fragment (it holds the manage token) from the address bar and history, like ManagePage.
let memoryHash: string | null = null;
function takeHash(): string {
  if (memoryHash === null) {
    memoryHash = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);
  }
  return memoryHash;
}

export default function SuccessPage({ btn, email }: { btn: string; email?: string }) {
  const [orderId = '', token = ''] = takeHash().split('.');
  const [status, setStatus] = React.useState<'checking' | 'paid' | 'failed' | 'expired' | 'timeout'>('checking');
  const slug = React.useMemo(() => { try { return sessionStorage.getItem('jlc_inv_slug') || ''; } catch { return ''; } }, []);

  React.useEffect(() => {
    if (!orderId) return setStatus('timeout');
    let tries = 0, stopped = false;
    const poll = async () => {
      if (stopped) return;
      tries++;
      try {
        const res = await fetch(`/api/invitations/order-status?order=${encodeURIComponent(orderId)}`);
        const s = res.ok ? (await res.json()).status : '';
        if (s === 'paid') {
          // The customiser's saved form is no longer needed
          try { for (const k of Object.keys(sessionStorage)) if (k.startsWith(DRAFT_KEY)) sessionStorage.removeItem(k); } catch { /* private mode */ }
          return setStatus('paid');
        }
        if (s === 'failed' || s === 'expired') return setStatus(s);
      } catch { /* keep polling */ }
      if (tries >= 40) return setStatus('timeout'); // 40 × 3 s = 2 minutes
      setTimeout(poll, 3000);
    };
    poll();
    return () => { stopped = true; };
  }, []);

  const manageLink = token && (
    <p className="text-sm text-slate-600">
      Want to start now? <a className="font-bold underline" href={`/manage#${token}`}>Manage your invitation</a>
      <span className="block text-xs text-slate-500 mt-1">This link works until the one in your email arrives. After that, use the emailed link.</span>
    </p>
  );

  return (
    <div className="bg-slate-50 py-20 px-4 select-text">
      <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center space-y-5" aria-live="polite">
        {status === 'checking' && <>
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-t-slate-900 animate-spin" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 font-display">Confirming your payment…</h1>
          <p className="text-sm text-slate-600">This usually takes a few seconds. Please keep this page open.</p>
        </>}

        {status === 'paid' && <>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Icons.PartyPopper className="h-7 w-7" /></div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">You're live!</h1>
          <p className="text-sm text-slate-600">Your invitation is published. We've emailed your receipt, your guest link and your private manage link. Keep the manage link to yourself: it lets you edit the invitation and see RSVPs.</p>
          {slug
            ? <a href={`/i/${encodeURIComponent(slug)}`} target="_blank" rel="noopener" className={`inline-flex items-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white ${btn}`}>
                View your invitation <Icons.ExternalLink className="ml-2 h-4 w-4" />
              </a>
            : <p className="text-sm text-slate-600">Your guest link is in the email.</p>}
          {manageLink}
        </>}

        {status === 'timeout' && <>
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto"><Icons.Mail className="h-7 w-7" /></div>
          <h1 className="text-xl font-extrabold text-slate-900 font-display">Still waiting for PayMongo</h1>
          <p className="text-sm text-slate-600">We haven't received the payment confirmation yet. There's nothing more you need to do: we'll email you as soon as PayMongo confirms, with your guest link and manage link.</p>
        </>}

        {status === 'failed' && <>
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto"><Icons.XCircle className="h-7 w-7" /></div>
          <h1 className="text-xl font-extrabold text-slate-900 font-display">The payment didn't go through</h1>
          <p className="text-sm text-slate-600">No payment was recorded for this order. You can start again from the designs page.</p>
          <Link href="/invitations" className="text-sm font-bold underline">Back to designs</Link>
        </>}

        {status === 'expired' && <>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto"><Icons.Clock className="h-7 w-7" /></div>
          <h1 className="text-xl font-extrabold text-slate-900 font-display">This order expired</h1>
          <p className="text-sm text-slate-600">
            This order expired. If you were charged,{' '}
            {email ? <>contact us at <a className="font-bold underline" href={`mailto:${email}`}>{email}</a></> : 'contact us'} and we'll refund you.
          </p>
          <Link href="/invitations" className="text-sm font-bold underline">Back to designs</Link>
        </>}
      </div>
    </div>
  );
}
