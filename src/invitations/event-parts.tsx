// Attire & motif and Gifts sections, placed by each layout with its own section, heading and kicker classes.
import { useEffect, useState, type ReactNode } from 'react';
import type { GiftMethod } from '../../shared/extras';
import { hasAttire, hasGiftExtras, peso, wishState, type EventData, type WishItem } from './event-view';
import { GiftQr, Photos } from './parts';

// After a layout's own photos: approved guest photos in the same gallery layout, then the guest page's upload form.
// Renders nothing without either, so invitations without guest photos are unchanged.
export function GuestGallery({ events, kicker, className }: { events?: EventData; kicker?: string; className?: string }) {
  const photos = events?.guestPhotos ?? [];
  if (!photos.length && !events?.guestShare) return null;
  return (
    <section className={cls('inv-ev inv-guest-gallery', className)} aria-label="Photos from guests">
      <div className="inv-ev-body">
        {photos.length > 0 && <><h3 className={kicker}>Shared by guests</h3><Photos photos={photos} title="Shared by guests" className="inv-gallery inv-guest-grid" layout={events!.galleryLayout ?? 'grid'} /></>}
        {events!.guestShare}
      </div>
    </section>
  );
}

// How a layout frames a section: its class, heading class, kicker class (for h3s) and anything drawn before the heading.
type Frame = { id: string; className?: string; headingClass?: string; kicker?: string; before?: ReactNode };
const cls = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ');

export function AttireSection({ events, dressCode, id, className, headingClass, kicker, before }: Frame & { events?: EventData; dressCode?: string }) {
  if (!hasAttire(events)) return null;
  const a = events!.attire ?? {};
  const photos = events!.attirePhotos ?? [];
  return (
    <section className={cls('inv-ev inv-attire', className)} aria-labelledby={id}>
      {before}
      <h2 id={id} className={headingClass}>Attire &amp; motif</h2>
      <div className="inv-ev-body">
        {a.motif && <p className="inv-motif">{a.motif}</p>}
        {!!a.palette?.length && (
          <ul className="inv-swatches" aria-label="Colour palette">
            {a.palette.map((c, i) => <li key={i}><span className="inv-swatch" role="img" aria-label={`Colour ${c}`} style={{ background: c }} /></li>)}
          </ul>
        )}
        {photos.length > 0 && (
          <ul className="inv-attire-photos">
            {photos.map((p, i) => (
              <li key={p.url}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Attire photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}, open full size in a new tab`}>
                  <img src={p.url} alt="" loading="lazy" decoding="async" />
                </a>
                {p.caption && <p className="inv-attire-cap">{p.caption}</p>}
              </li>
            ))}
          </ul>
        )}
        {a.notes && <p className="inv-pre">{a.notes}</p>}
        {dressCode && <><h3 className={kicker}>Dress code</h3><p className="inv-pre">{dressCode}</p></>}
      </div>
    </section>
  );
}

function WishCard({ item, events: e }: { item: WishItem; events: EventData }) {
  const state = wishState(item, !!e.onReserve);
  const busy = e.busyId === item.id;
  const msg = e.wishMessage?.id === item.id ? e.wishMessage : null;
  return (
    <>
      <p className="inv-wish-name">{item.name}</p>
      {item.priceCentavos != null && <p className="inv-wish-price">{peso(item.priceCentavos)}</p>}
      {item.note && <p className="inv-wish-note">{item.note}</p>}
      {item.link && <a className="inv-wish-link" href={item.link} target="_blank" rel="noopener noreferrer">View item<span className="inv-sr">: {item.name} (opens in a new tab)</span></a>}
      {state === 'open' && <button type="button" className="btn" disabled={busy} onClick={() => e.onReserve!(item)}>I'll give this<span className="inv-sr">: {item.name}</span></button>}
      {state === 'reserved' && <button type="button" className="btn inv-wish-taken" disabled aria-disabled="true">Reserved</button>}
      {state === 'yours' && (
        <p className="inv-wish-yours">
          You're giving this ·{' '}
          <button type="button" className="inv-linkbtn" disabled={busy} onClick={() => e.onRelease?.(item)}>Undo<span className="inv-sr"> your choice of {item.name}</span></button>
        </p>
      )}
      {msg && <p className={msg.error ? 'inv-wish-error' : 'inv-wish-thanks'} role={msg.error ? 'alert' : 'status'}>{msg.text}</p>}
    </>
  );
}

function CashMethod({ m }: { m: GiftMethod }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = () => { navigator.clipboard?.writeText(m.accountNumber).then(() => setCopied(true), () => {}); };
  return (
    <>
      <p className="inv-cash-label">{m.label}</p>
      {m.accountName && <p>{m.accountName}</p>}
      <p className="inv-cash-number">
        <span>{m.accountNumber}</span>
        <button type="button" className="btn inv-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}<span className="inv-sr"> the {m.label} number</span></button>
      </p>
      <span className="inv-sr" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </>
  );
}

// Used only when the wish list or cash methods exist; otherwise each layout keeps its old gift block (note and QR).
export function GiftsSection({ events, note, qr, id, className, headingClass, kicker, before }: Frame & { events?: EventData; note?: string; qr?: string }) {
  if (!hasGiftExtras(events)) return null;
  const items = events!.giftItems ?? [];
  const methods = events!.giftMethods ?? [];
  return (
    <section className={cls('inv-ev inv-gifts', className)} aria-labelledby={id}>
      {before}
      <h2 id={id} className={headingClass}>Gifts</h2>
      <div className="inv-ev-body">
        {note && <p className="inv-pre">{note}</p>}
        {items.length > 0 && (
          <>
            <h3 className={kicker}>Wish list</h3>
            <ul className="inv-wish">{items.map((it) => <li key={it.id} className="inv-wish-item" data-wish={it.id} tabIndex={-1}><WishCard item={it} events={events!} /></li>)}</ul>
          </>
        )}
        {(methods.length > 0 || qr) && (
          <>
            <h3 className={kicker}>Cash gifts</h3>
            {methods.length > 0 && <p>{qr ? 'Scan or send to any of the accounts below.' : 'Send to any of the accounts below.'} Thank you!</p>}
            <GiftQr src={qr} />
            {methods.length > 0 && <ul className="inv-cash">{methods.map((m, i) => <li key={i} className="inv-cash-item"><CashMethod m={m} /></li>)}</ul>}
          </>
        )}
      </div>
    </section>
  );
}
