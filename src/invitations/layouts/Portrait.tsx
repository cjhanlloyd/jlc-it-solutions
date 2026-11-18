// Portrait: a full-bleed, photo-led card for any occasion. The front text comes from the occasion's card();
// with a cover photo the hero is a tall photo with the text at the bottom, without one it is a framed typographic hero.
import type { LayoutProps } from '.';
import type { Venue } from '../../../shared/invitation-fields';
import { occasionForDetails } from '../../../shared/occasions';
import { Cover, Countdown, displayVars, MapLink, GiftQr, Photos, heroAttrs, longDate, schemeVars, time12, venues } from '../parts';
import { coverFor } from '../style-render';
import { AttireSection, GiftsSection, GuestGallery } from '../event-parts';
import { legacyNotes } from '../event-view';

export default function Portrait({ details: d, scheme, photos: all, style, rsvpSlot, giftQr, events }: LayoutProps) {
  const { cover, gallery: photos } = coverFor(style, all);
  const n = legacyNotes(events, d.dressCode, d.giftsNote, giftQr);
  const occasion = occasionForDetails(d);
  const c = occasion.card(d);
  // Weddings label their ceremony and reception; the other occasions have one venue.
  const places: [string, Venue][] = 'ceremony' in d ? venues(d) : d.venue?.name ? [['', d.venue]] : [];
  return (
    <main className="inv pt" style={{ ...schemeVars(scheme, style), ...displayVars(scheme) }}>
      <header {...heroAttrs('pt-hero', cover, scheme.primary)}>
        {cover && <Cover {...cover} />}
        <div className="pt-front">
          {c.kicker && <p className="pt-kicker">{c.kicker}</p>}
          <h1 className="pt-headline">{c.headline}</h1>
          {c.subline && <p className="pt-subline">{c.subline}</p>}
        </div>
      </header>

      <div className="pt-wrap">
        {c.dateLine && (
          <section aria-labelledby="pt-when">
            <h2 id="pt-when">When</h2>
            <p className="pt-date">{c.dateLine}</p>
            <Countdown details={d} className="pt-countdown" />
          </section>
        )}

        {d.message && <p className="pt-message">{d.message}</p>}

        {places.length > 0 && (
          <section aria-labelledby="pt-where">
            <h2 id="pt-where">Where</h2>
            {places.map(([label, v]) => (
              <div key={label} className="pt-venue">
                {label && <p className="pt-kicker">{label}</p>}
                <h3>{v.name}</h3>
                {v.address && <p>{v.address}</p>}
                <MapLink venue={v} />
              </div>
            ))}
          </section>
        )}

        {d.schedule?.length > 0 && (
          <section aria-labelledby="pt-program">
            <h2 id="pt-program">Program</h2>
            <ol className="pt-schedule">
              {d.schedule.map((s: { time: string; label: string }, i: number) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(n.dress || n.gifts) && (
          <section aria-labelledby="pt-notes">
            <h2 id="pt-notes">Good to know</h2>
            {n.dress && <><h3 className="pt-kicker">Attire</h3><p>{d.dressCode}</p></>}
            {n.gifts && <><h3 className="pt-kicker">Gifts</h3>{d.giftsNote && <p>{d.giftsNote}</p>}<GiftQr src={giftQr} /></>}
          </section>
        )}
        <AttireSection events={events} dressCode={d.dressCode} id="pt-attire" kicker="pt-kicker" />
        <GiftsSection events={events} note={d.giftsNote} qr={giftQr} id="pt-gifts" kicker="pt-kicker" />

        <Photos photos={photos} title={occasion.title(d)} className="pt-photos" layout={events?.galleryLayout} />
        <GuestGallery events={events} kicker="pt-kicker" />

        {d.hostedBy && (
          <section aria-labelledby="pt-host">
            <h2 id="pt-host">Hosted by</h2>
            <p>{d.hostedBy}</p>
          </section>
        )}

        {rsvpSlot && (
          <section aria-labelledby="pt-rsvp">
            <h2 id="pt-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
