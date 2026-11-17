// Guest page entry (/i/<slug>). Kept apart from the main app: never import from src/components/ here.
import { StrictMode, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LIMITS } from '../../shared/invitation-fields';
import type { InvitationStyle } from '../../shared/invitation-style';
import { occasionOf } from '../../shared/occasions';
import IntroCover from './IntroCover';
import InvitationView from './InvitationView';
import MusicToggle, { type Music } from './MusicToggle';
import { Ornament, schemeVars, type Scheme } from './parts';
import { effectiveScheme } from './style-render';
import { seatOptions } from './customer-ui';

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
  | { state: 'live'; layoutKey: string; colorScheme: Scheme; details: any; photos: string[]; giftQr?: string | null; style?: InvitationStyle; rsvpOpen: boolean; askKids?: boolean; productType?: string;
      tier?: 'standard' | 'premium'; intro?: boolean; music?: Music | null; guest?: Guest }
  | { state: 'expired'; title: string }
  | { state: 'missing' | 'offline' | 'loading' };

const NEUTRAL: Scheme = { primary: '#7a5752', accent: '#b8955a', background: '#faf7f2', text: '#3a3330' };
const slug = window.location.pathname.match(/^\/i\/([^/]+)\/?$/)?.[1] ?? '';
// A personal guest link (?g=<token>): the server answers with the guest's name, seats and current reply
const guestToken = new URLSearchParams(window.location.search).get('g') ?? '';
type Guest = { name: string; seats: number; rsvp: { attending: boolean; partySize: number } | null };

function RsvpForm({ askKids, productType, guest }: { askKids: boolean; productType?: string; guest?: Guest }) {
  const [name, setName] = useState(guest?.name ?? '');
  const [attending, setAttending] = useState<boolean | null>(guest?.rsvp?.attending ?? null);
  // Seats may have been lowered since the reply, so the prefill is clamped to them
  const [partySize, setPartySize] = useState(() => Math.max(1, Math.min(guest?.rsvp?.attending ? guest.rsvp.partySize : 1, guest?.seats ?? LIMITS.partySizeMax)));
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
        body: JSON.stringify({ guestName: name, attending, partySize: attending ? partySize : 1, ...(askKids ? { kidsCount: attending ? kidsCount : 0 } : {}), message, turnstileToken, ...(guest ? { guestToken } : {}) }),
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
  const seats = guest?.seats;
  return (
    <form className="rsvp" onSubmit={submit}>
      {guest && (
        <p className="rsvp-seats">
          We've saved {seats === 1 ? 'a seat for you' : `${seats} seats for you`}.
          {guest.rsvp && <> You replied: <strong>{guest.rsvp.attending ? `attending, ${guest.rsvp.partySize} ${guest.rsvp.partySize === 1 ? 'guest' : 'guests'}` : "can't make it"}</strong>. You can change your reply below.</>}
        </p>
      )}
      <div>
        <label htmlFor="rsvp-name">Your name</label>
        {guest
          ? <input id="rsvp-name" type="text" readOnly aria-describedby="rsvp-name-note" value={name} />
          : <input id="rsvp-name" type="text" required maxLength={LIMITS.rsvpName} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        {guest && <p id="rsvp-name-note" className="rsvp-note">Replying as {guest.name}</p>}
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
            {seatOptions(1, LIMITS.partySizeMax, seats, askKids ? kidsCount : 0).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
      {attending && askKids && (
        <div>
          <label htmlFor="rsvp-kids">Kids</label>
          <select id="rsvp-kids" value={kidsCount} onChange={(e) => setKidsCount(Number(e.target.value))}>
            {seatOptions(0, LIMITS.kidsMax, seats, partySize).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="rsvp-message">{productType === 'wedding_invitation' ? 'Message for the couple' : 'Message for the celebrant'} <span className="rsvp-optional">(optional)</span></label>
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
  const audio = useRef<HTMLAudioElement>(null);
  const [opened, setOpened] = useState(false);
  const onDone = useCallback(() => setOpened(true), []);
  // Once the cover is gone the invitation is no longer inert, so focus can move into it.
  useEffect(() => {
    if (!opened) return;
    const main = document.querySelector<HTMLElement>('.inv-root main');
    if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); }
  }, [opened]);
  useEffect(() => {
    if (!slug) return setData({ state: 'missing' });
    fetch(`/api/invitations/i/${slug}${guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''}`)
      .then(async (res) => setData(res.ok ? await res.json() : { state: 'missing' }))
      .catch(() => setData({ state: 'offline' }));
  }, []);

  switch (data.state) {
    case 'loading':
      return <main className="inv plain" style={schemeVars(NEUTRAL)}><p className="plain-loading" role="status">Opening your invitation…</p></main>;
    case 'live': {
      // Cover and music sit outside InvitationView, so studio and admin previews never show them
      const scheme = effectiveScheme(data.colorScheme, data.style ?? {});
      const card = data.intro ? occasionOf(data.productType)?.card(data.details) : undefined;
      return (
        <>
          {card && <IntroCover card={card} scheme={scheme} greeting={data.guest?.name} onOpen={() => audio.current?.play().catch(() => {})} onDone={onDone} />}
          {/* Behind the aria-modal cover the page is inert, so keyboard and screen readers cannot reach it */}
          <div inert={!!card && !opened} aria-hidden={card && !opened ? true : undefined}>
          <InvitationView layoutKey={data.layoutKey} scheme={data.colorScheme} details={data.details} photos={data.photos} giftQr={data.giftQr ?? undefined} style={data.style}
            rsvpSlot={<>
              {data.guest && <p className="rsvp-dear">Dear {data.guest.name},</p>}
              {data.rsvpOpen ? <RsvpForm askKids={!!data.askKids} productType={data.productType} guest={data.guest} /> : <p className="rsvp-closed">RSVPs are now closed. Thank you!</p>}
            </>} />
          {data.music && <MusicToggle ref={audio} music={data.music} scheme={scheme} />}
          </div>
        </>
      );
    }
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
