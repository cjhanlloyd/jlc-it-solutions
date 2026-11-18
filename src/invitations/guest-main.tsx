// Guest page entry (/i/<slug>). Kept apart from the main app: never import from src/components/ here.
import { StrictMode, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
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
import { useTurnstile } from './turnstile';
import type { Extras } from '../../shared/extras';
import type { AttirePhoto, EventData, WishItem } from './event-view';
import GuestShare from './GuestShare';
import QrCode, { downloadQrPng } from './QrCode';

type Data =
  | { state: 'live'; layoutKey: string; colorScheme: Scheme; details: any; photos: string[]; giftQr?: string | null; style?: InvitationStyle; rsvpOpen: boolean; askKids?: boolean; productType?: string;
      tier?: 'standard' | 'premium'; intro?: boolean; music?: Music | null; guest?: Guest;
      extras?: Extras; attirePhotos?: AttirePhoto[]; giftItems?: WishItem[]; guestPhotos?: string[]; pass?: Pass }
  | { state: 'expired'; title: string }
  | { state: 'missing' | 'offline' | 'loading' };

const NEUTRAL: Scheme = { primary: '#7a5752', accent: '#b8955a', background: '#faf7f2', text: '#3a3330' };
const slug = window.location.pathname.match(/^\/i\/([^/]+)\/?$/)?.[1] ?? '';
// A personal guest link (?g=<token>): the server answers with the guest's name, seats and current reply
const guestToken = new URLSearchParams(window.location.search).get('g') ?? '';
type Guest = { name: string; seats: number; rsvp: { attending: boolean; partySize: number; kidsCount: number; message: string } | null };

function RsvpForm({ askKids, productType, guest }: { askKids: boolean; productType?: string; guest?: Guest }) {
  const [name, setName] = useState(guest?.name ?? '');
  const [attending, setAttending] = useState<boolean | null>(guest?.rsvp?.attending ?? null);
  // Seats may have been lowered since the reply, so the prefill is clamped to them
  const [partySize, setPartySize] = useState(() => Math.max(1, Math.min(guest?.rsvp?.attending ? guest.rsvp.partySize : 1, guest?.seats ?? LIMITS.partySizeMax)));
  const [kidsCount, setKidsCount] = useState(() => guest?.rsvp?.attending ? guest.rsvp.kidsCount : 0);
  const [message, setMessage] = useState(guest?.rsvp?.message ?? '');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { ref: turnstileContainer, token: turnstileToken, error: turnstileError, reset: resetTurnstile } = useTurnstile();

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
    resetTurnstile();
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
          {guest.rsvp && <> You replied: <strong>{guest.rsvp.attending ? (askKids ? `attending, ${guest.rsvp.partySize} ${guest.rsvp.partySize === 1 ? 'adult' : 'adults'}${guest.rsvp.kidsCount ? `, ${guest.rsvp.kidsCount} ${guest.rsvp.kidsCount === 1 ? 'kid' : 'kids'}` : ''}` : `attending, ${guest.rsvp.partySize} ${guest.rsvp.partySize === 1 ? 'guest' : 'guests'}`) : "can't make it"}</strong>. You can change your reply below.</>}
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

type Pass = { url: string; name: string; partySize: number };
// The guest's QR entry pass: always black on white, whatever the colour scheme, so door phones scan it reliably.
function EntryPass({ pass }: { pass: Pass }) {
  return (
    <section aria-labelledby="pass-h" style={{ marginTop: '2rem', textAlign: 'center' }}>
      <h2 id="pass-h">Your entry pass</h2>
      <div style={{ display: 'inline-block', maxWidth: '100%', background: '#fff', color: '#111', borderRadius: 12, padding: 16 }}>
        <QrCode text={pass.url} label={`Entry pass QR code for ${pass.name}`} />
        <p style={{ margin: '8px 0 0', fontWeight: 700 }}>{pass.name}</p>
        <p style={{ margin: 0 }}>Party of {pass.partySize}</p>
      </div>
      <p>Show this at the entrance.</p>
      <button type="button" className="btn" onClick={() => downloadQrPng(pass.url, 'entry-pass.png')}>Save to your phone</button>
    </section>
  );
}

const OFFLINE = 'We could not reach the server. Please check your connection and try again.';
const post = (path: string, body: unknown) =>
  fetch(`/api/invitations/i/${slug}/gifts/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// "I'll give this": the guest's name (locked with a guest link) and Turnstile, in a native modal dialog.
function ReserveDialog({ item, guest, style, onClose, onReserved, onTaken }: {
  item: WishItem; guest?: Guest; style: CSSProperties; onClose: () => void; onReserved: () => void; onTaken: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(guest?.name ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const turnstile = useTurnstile();
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setSending(true);
    setError('');
    try {
      const res = await post('reserve', { itemId: item.id, name, turnstileToken: turnstile.token, ...(guest ? { guestToken } : {}) });
      if (res.ok) return onReserved();
      const message = (await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.';
      if (res.status === 409) return onTaken(message);
      setError(message);
    } catch {
      setError(OFFLINE);
    } finally {
      setSending(false);
    }
    turnstile.reset();
  }

  return (
    <dialog ref={dialog} className="inv inv-dialog" style={style} aria-labelledby="wish-dialog-h" onClose={onClose}>
      <form className="rsvp" onSubmit={submit}>
        <h2 id="wish-dialog-h">I'll give this</h2>
        <p className="inv-dialog-item">{item.name}</p>
        <div>
          <label htmlFor="wish-name">Your name</label>
          {guest
            ? <input id="wish-name" type="text" readOnly aria-describedby="wish-name-note" value={name} />
            : <input id="wish-name" type="text" required maxLength={80} autoComplete="name" aria-describedby="wish-name-note" value={name} onChange={(e) => setName(e.target.value)} />}
          <p id="wish-name-note" className="rsvp-note">{guest ? 'Only the hosts will see your name. You can undo this later from this link.' : 'Only the hosts will see your name.'}</p>
        </div>
        <div>
          <div ref={turnstile.ref} className="rsvp-turnstile" />
          {turnstile.error && <p className="rsvp-error">{turnstile.error}</p>}
        </div>
        {error && <p className="rsvp-error" role="alert">{error}</p>}
        <div className="inv-dialog-actions">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn-solid" disabled={sending}>{sending ? 'Saving…' : 'Confirm'}</button>
        </div>
      </form>
    </dialog>
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
  const [reserving, setReserving] = useState<WishItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [wishMessage, setWishMessage] = useState<{ id: number; text: string; error?: boolean } | null>(null);
  // Updates one wish list item in place and moves focus to its card, since the button the guest used is gone.
  const patchItem = (id: number, patch: Partial<WishItem>) => {
    setData((d) => d.state === 'live' ? { ...d, giftItems: d.giftItems?.map((it) => it.id === id ? { ...it, ...patch } : it) } : d);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-wish="${id}"]`)?.focus());
  };
  async function release(item: WishItem) {
    setBusyId(item.id);
    setWishMessage(null);
    try {
      const res = await post('release', { itemId: item.id, guestToken });
      if (res.ok) patchItem(item.id, { reserved: false, reservedByYou: undefined });
      else setWishMessage({ id: item.id, text: (await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.', error: true });
    } catch {
      setWishMessage({ id: item.id, text: OFFLINE, error: true });
    } finally {
      setBusyId(null);
    }
  }
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
      const item = reserving;
      const events: EventData = {
        attire: data.extras?.attire, attirePhotos: data.attirePhotos, giftItems: data.giftItems, giftMethods: data.extras?.gifts?.methods,
        onReserve: (it) => { setWishMessage(null); setReserving(it); }, onRelease: release, busyId, wishMessage,
        galleryLayout: data.extras?.gallery?.layout, guestPhotos: data.guestPhotos,
        guestShare: data.extras?.guestPhotos?.enabled ? <GuestShare slug={slug} guestName={data.guest?.name} guestToken={data.guest ? guestToken : undefined} /> : undefined,
      };
      return (
        <>
          {card && <IntroCover card={card} scheme={scheme} greeting={data.guest?.name} onOpen={() => audio.current?.play().catch(() => {})} onDone={onDone} />}
          {/* Behind the aria-modal cover the page is inert, so keyboard and screen readers cannot reach it */}
          <div inert={!!card && !opened} aria-hidden={card && !opened ? true : undefined}>
          <InvitationView layoutKey={data.layoutKey} scheme={data.colorScheme} details={data.details} photos={data.photos} giftQr={data.giftQr ?? undefined} style={data.style} events={events}
            rsvpSlot={<>
              {data.guest && <p className="rsvp-dear">Dear {data.guest.name},</p>}
              {data.rsvpOpen ? <RsvpForm askKids={!!data.askKids} productType={data.productType} guest={data.guest} /> : <p className="rsvp-closed">RSVPs are now closed. Thank you!</p>}
              {data.pass && <EntryPass pass={data.pass} />}
            </>} />
          {item && (
            <ReserveDialog item={item} guest={data.guest} style={schemeVars(scheme, data.style)} onClose={() => setReserving(null)}
              onReserved={() => {
                setReserving(null);
                patchItem(item.id, { reserved: true, reservedByYou: data.guest ? true : undefined });
                if (!data.guest) setWishMessage({ id: item.id, text: 'Thank you! The hosts will know this gift is from you.' });
              }}
              onTaken={(text) => { setReserving(null); patchItem(item.id, { reserved: true }); setWishMessage({ id: item.id, text, error: true }); }} />
          )}
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
