// Guest page entry (/i/<slug>). Kept apart from the main app: never import from src/components/ here.
import { StrictMode, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LIMITS } from '../../shared/invitation-fields';
import InvitationView from './InvitationView';
import { Ornament, schemeVars, type Scheme } from './parts';

// Cloudflare Turnstile, same as src/components/InquiryForm.tsx. On localhost, use Cloudflare's always-pass test key.
const TURNSTILE_SITE_KEY = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAF6Se95DZhEd5led';

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  return (turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve();
    script.onerror = () => { turnstileScript = null; reject(new Error('Turnstile failed to load')); };
    document.head.appendChild(script);
  }));
}

type Data =
  | { state: 'live'; layoutKey: string; colorScheme: Scheme; details: any; photos: string[]; rsvpOpen: boolean; askKids?: boolean }
  | { state: 'expired'; title: string }
  | { state: 'missing' | 'offline' | 'loading' };

const NEUTRAL: Scheme = { primary: '#7a5752', accent: '#b8955a', background: '#faf7f2', text: '#3a3330' };
const slug = window.location.pathname.match(/^\/i\/([^/]+)\/?$/)?.[1] ?? '';

function RsvpForm({ askKids }: { askKids: boolean }) {
  const [name, setName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [kidsCount, setKidsCount] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const turnstileWidgetId = useRef<string | null>(null);

  const turnstileContainer = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let unmounted = false;
    loadTurnstile().then(() => {
      if (unmounted) return;
      turnstileWidgetId.current = (window as any).turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => { setTurnstileToken(token); setTurnstileError(''); },
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    }).catch(() => setTurnstileError('The anti-spam check could not load. Please disable content blockers for this site and reload.'));
    return () => {
      unmounted = true;
      if (turnstileWidgetId.current) (window as any).turnstile?.remove(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
      setTurnstileToken('');
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (attending === null) return;
    if (!turnstileToken) return setError('Please wait for the anti-spam check to finish, then send again.');
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/invitations/i/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: name, attending, partySize: attending ? partySize : 1, ...(askKids ? { kidsCount: attending ? kidsCount : 0 } : {}), message, turnstileToken }),
      });
      if (res.ok) return setDone(true);
      setError((await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
    // A Turnstile token works once, so get a fresh one for the next try.
    setTurnstileToken('');
    if (turnstileWidgetId.current) (window as any).turnstile?.reset(turnstileWidgetId.current);
  }

  if (done) {
    return (
      <p className="rsvp-done" role="status">
        {attending ? 'Thank you! Your reply has been sent. We cannot wait to celebrate with you.' : 'Thank you for letting us know. You will be missed.'}
      </p>
    );
  }
  return (
    <form className="rsvp" onSubmit={submit}>
      <div>
        <label htmlFor="rsvp-name">Your name</label>
        <input id="rsvp-name" type="text" required maxLength={LIMITS.rsvpName} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset>
        <legend>Will you attend?</legend>
        <div className="rsvp-choices">
          <label className="rsvp-choice"><input type="radio" name="attending" required checked={attending === true} onChange={() => setAttending(true)} /> Joyfully accepts</label>
          <label className="rsvp-choice"><input type="radio" name="attending" checked={attending === false} onChange={() => setAttending(false)} /> Regretfully declines</label>
        </div>
      </fieldset>
      {attending && (
        <div>
          <label htmlFor="rsvp-party">{askKids ? 'Adults, including you' : 'Number of guests, including you'}</label>
          <select id="rsvp-party" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}>
            {Array.from({ length: LIMITS.partySizeMax }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      )}
      {attending && askKids && (
        <div>
          <label htmlFor="rsvp-kids">Kids</label>
          <select id="rsvp-kids" value={kidsCount} onChange={(e) => setKidsCount(Number(e.target.value))}>
            {Array.from({ length: LIMITS.kidsMax + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="rsvp-message">{askKids ? 'Message for the celebrant' : 'Message for the couple'} <span className="rsvp-optional">(optional)</span></label>
        <textarea id="rsvp-message" rows={3} maxLength={LIMITS.rsvpMessage} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div>
        <div ref={turnstileContainer} className="rsvp-turnstile" />
        {turnstileError && <p className="rsvp-error">{turnstileError}</p>}
      </div>
      {error && <p className="rsvp-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-solid" disabled={sending}>{sending ? 'Sending…' : 'Send reply'}</button>
    </form>
  );
}

const Plain = ({ title, children }: { title: string; children: ReactNode }) => (
  <main className="inv plain" style={schemeVars(NEUTRAL)}>
    <div>
      <Ornament className="plain-orn" />
      <h1>{title}</h1>
      {children}
      <Ornament className="plain-orn" />
    </div>
  </main>
);

function Guest() {
  const [data, setData] = useState<Data>({ state: 'loading' });
  useEffect(() => {
    if (!slug) return setData({ state: 'missing' });
    fetch(`/api/invitations/i/${slug}`)
      .then(async (res) => setData(res.ok ? await res.json() : { state: 'missing' }))
      .catch(() => setData({ state: 'offline' }));
  }, []);

  switch (data.state) {
    case 'loading':
      return <main className="inv plain" style={schemeVars(NEUTRAL)}><p className="plain-loading" role="status">Opening your invitation…</p></main>;
    case 'live':
      return (
        <InvitationView layoutKey={data.layoutKey} scheme={data.colorScheme} details={data.details} photos={data.photos}
          rsvpSlot={data.rsvpOpen ? <RsvpForm askKids={!!data.askKids} /> : <p className="rsvp-closed">RSVPs are now closed. Thank you!</p>} />
      );
    case 'expired':
      return (
        <Plain title={data.title}>
          <p>This celebration has passed.</p>
          <p>Thank you for being part of their story.</p>
        </Plain>
      );
    case 'offline':
      return (
        <Plain title="We couldn't open this invitation">
          <p>Please check your connection and try again.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Try again</button>
        </Plain>
      );
    default:
      return (
        <Plain title="Invitation not available">
          <p>This invitation link is not active. Please check the link with whoever shared it.</p>
        </Plain>
      );
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><Guest /></StrictMode>);
