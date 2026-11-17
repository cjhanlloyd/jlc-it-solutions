// /account: passwordless sign-in (emailed 6-digit code), then the customer's invitations. The session token lives in localStorage.
import React from 'react';
import { ArrowRight, CalendarDays, LogOut, Mail } from 'lucide-react';
import { Alert, Link, peso, useTurnstile } from './kit';
import { occasionLabel } from './occasions';
import { PremiumBadge } from '../site/DesignCard';
import LinkBox, { focusRing, primaryBtn, secondaryBtn } from './LinkBox';
import AccountReview from './AccountReview';
import { clearSession, readSession, saveSession, type CustomerSession } from './customer-ui';

type Order = {
  reference: string; status: string; statusLabel: string; createdAt: string; amountCentavos: number; packageName: string | null;
  tier: 'standard' | 'premium'; designName: string | null; productType: string | null; title: string; eventDate: string | null;
  invitationId: number | null; slug?: string; live?: boolean;
};

const fieldCls = `w-full rounded-xl border border-gold bg-white px-4 py-3 text-base text-ink focus:border-brand-700 ${focusRing}`;
const labelCls = 'mb-1.5 block text-sm font-semibold text-ink';
const linkBtn = `min-h-11 px-2 text-sm font-semibold text-brand-700 underline decoration-gold underline-offset-4 hover:text-brand-800 cursor-pointer ${focusRing}`;
const OFFLINE = 'We could not reach the server. Please check your connection and try again.';

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`/api/account${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const longDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  .toLocaleDateString('en-PH', { dateStyle: 'long', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) });

// Brand-toned status pills, all at AA contrast.
const PILL: Record<string, string> = {
  delivered: 'bg-brand-50 text-brand-800 border-brand-200', completed: 'bg-brand-50 text-brand-800 border-brand-200',
  cancelled: 'bg-white text-ink border-ink/30', refunded: 'bg-white text-ink border-ink/30',
};
const pillCls = (status: string) => PILL[status] ?? 'bg-sand text-ink border-gold-light';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card border border-gold-light bg-white p-6 shadow-card sm:p-8 ${className}`}>{children}</div>;
}

function SignIn({ onSignedIn }: { onSignedIn: (s: CustomerSession) => void }) {
  const [step, setStep] = React.useState<'email' | 'code'>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const turnstile = useTurnstile();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setBusy(true);
    setError('');
    try {
      const res = await post('/code', { email: email.trim(), turnstileToken: turnstile.token });
      if (res.ok) { setCode(''); setStep('code'); setBusy(false); return; }
      setError((await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.');
    } catch {
      setError(OFFLINE);
    }
    turnstile.reset();
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await post('/verify', { email: email.trim(), code: code.trim() });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.token) return onSignedIn({ token: body.token, email: body.email });
      setError(body.error || 'Something went wrong. Please try again.');
    } catch {
      setError(OFFLINE);
    }
    setBusy(false);
  }

  const back = (keepEmail: boolean) => { if (!keepEmail) setEmail(''); setError(''); setStep('email'); };

  return (
    <div className="bg-ivory px-4 py-16 font-sans text-ink sm:py-24">
      <Card className="mx-auto max-w-md">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Mail className="h-5 w-5" aria-hidden="true" /></span>
          <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight">{step === 'email' ? 'Sign in to your account' : 'Check your email'}</h1>
          <div className="mx-auto mt-4 h-px w-16 bg-gold" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink/80" aria-live="polite">
            {step === 'email'
              ? "We'll email you a 6-digit code. No password needed."
              : <>We sent a code to <strong className="break-all font-semibold text-ink">{email.trim()}</strong> if it is the email you ordered with. It expires in 10 minutes.</>}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="mt-8 space-y-5">
            <div>
              <label htmlFor="acct-email" className={labelCls}>Email used at checkout</label>
              <input id="acct-email" className={fieldCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div ref={turnstile.ref} className="min-h-[65px]" />
            {turnstile.error && <p role="alert" className="text-xs text-red-700">{turnstile.error}</p>}
            {error && <Alert>{error}</Alert>}
            <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>{busy ? 'Sending…' : 'Email me a code'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-8 space-y-5">
            <div>
              <label htmlFor="acct-code" className={labelCls}>6-digit code</label>
              <input id="acct-code" className={`${fieldCls} text-center font-mono text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <p className="mt-1.5 text-xs text-ink/80">Not there? Check your spam folder.</p>
            </div>
            {error && <Alert>{error}</Alert>}
            <button type="submit" disabled={busy || code.length !== 6} className={`${primaryBtn} w-full`}>{busy ? 'Checking…' : 'Verify and sign in'}</button>
            <div className="flex flex-wrap justify-center gap-x-4">
              <button type="button" className={linkBtn} onClick={() => back(false)}>Use a different email</button>
              <button type="button" className={linkBtn} onClick={() => back(true)}>Send a new code</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const url = o.live && o.slug ? `${window.location.origin}/i/${o.slug}` : '';
  const closed = o.status === 'cancelled' || o.status === 'refunded';
  return (
    <li>
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-brand-700">
              {[o.designName, o.productType && occasionLabel(o.productType)].filter(Boolean).join(' · ') || 'Invitation'}
            </p>
            <h2 className="mt-1 break-words font-serif text-2xl font-semibold leading-snug text-ink">{o.title || 'Your invitation'}</h2>
            {o.eventDate && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/80"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" /> {longDate(o.eventDate)}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${pillCls(o.status)}`}>{o.statusLabel}</span>
        </div>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink/80">
          {o.tier === 'premium' && <PremiumBadge />}
          <div className="flex gap-1.5"><dt>Order</dt><dd className="font-mono font-semibold text-ink">{o.reference}</dd></div>
          <div className="flex gap-1.5"><dt className="sr-only">Amount</dt><dd className="font-semibold text-ink">{peso(o.amountCentavos)}</dd></div>
          <div className="flex gap-1.5"><dt>Ordered</dt><dd>{longDate(o.createdAt)}</dd></div>
        </dl>
        {url ? (
          <>
            <LinkBox url={url} title={o.title} />
            <Link href={`/manage?inv=${o.invitationId}`} className={`${primaryBtn} w-full sm:w-auto`}>
              Edit invitation &amp; guests <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        ) : !closed && o.status !== 'delivered' && (
          <Link href="/track" className={`${secondaryBtn} w-full sm:w-auto`}>Track this order <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        )}
      </Card>
    </li>
  );
}

function Dashboard({ session, onSignOut }: { session: CustomerSession; onSignOut: () => void }) {
  const [orders, setOrders] = React.useState<Order[] | null | 'offline'>(null);
  const [email, setEmail] = React.useState(session.email);

  const load = React.useCallback(() => {
    setOrders(null);
    fetch('/api/account', { headers: { 'X-Customer-Token': session.token } }).then(async (res) => {
      if (res.status === 401) return onSignOut();
      if (!res.ok) return setOrders('offline');
      const body = await res.json();
      setEmail(body.email);
      setOrders(body.orders);
    }).catch(() => setOrders('offline'));
  }, [session.token, onSignOut]);
  React.useEffect(load, [load]);

  function signOut() {
    post('/logout', {}, { 'X-Customer-Token': session.token }).catch(() => { /* the local session goes either way */ });
    onSignOut();
  }

  return (
    <div className="bg-ivory px-4 py-12 font-sans text-ink sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gold-light pb-6">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-brand-700">My account</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">Your invitations</h1>
            <p className="mt-2 break-all text-sm text-ink/80">Signed in as <span className="font-semibold text-ink">{email}</span></p>
          </div>
          <button type="button" onClick={signOut} className={secondaryBtn}><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button>
        </header>

        {orders === null && <p role="status" className="py-12 text-center text-sm text-ink/80">Loading your invitations…</p>}
        {orders === 'offline' && (
          <Card className="text-center">
            <p className="text-sm text-ink/80">We could not load your invitations. Please check your connection and try again.</p>
            <button type="button" onClick={load} className={`${primaryBtn} mt-5`}>Try again</button>
          </Card>
        )}
        {Array.isArray(orders) && orders.length === 0 && (
          <Card className="text-center">
            <h2 className="font-serif text-3xl font-semibold">No invitations yet</h2>
            <div className="mx-auto mt-4 h-px w-16 bg-gold" aria-hidden="true" />
            <p className="mt-4 text-sm text-ink/80">Orders placed with {email} will appear here.</p>
            <Link href="/designs" className={`${primaryBtn} mt-6`}>Browse designs <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </Card>
        )}
        {Array.isArray(orders) && orders.length > 0 && <ul className="space-y-6">{orders.map((o) => <React.Fragment key={o.reference}><OrderCard o={o} /></React.Fragment>)}</ul>}

        {Array.isArray(orders) && <AccountReview token={session.token} onSignOut={onSignOut} />}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [session, setSession] = React.useState(readSession);
  const signedOut = React.useCallback(() => { clearSession(); setSession(null); }, []);
  if (!session) return <SignIn onSignedIn={(s) => { saveSession(s); setSession(s); }} />;
  return <Dashboard session={session} onSignOut={signedOut} />;
}
