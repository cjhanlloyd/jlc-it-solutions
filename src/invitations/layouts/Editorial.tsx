// Editorial: a magazine-style wedding. A big photo cover (or a bold typographic masthead), oversized serif names,
// a date and venue band, then numbered sections between thin rules.
import type { LayoutProps } from '.';
import { wedding, type InvitationDetails } from '../../../shared/occasions/wedding';
import { Cover, Countdown, displayVars, MapLink, GiftQr, Photos, formatDate, heroAttrs, longDate, schemeVars, time12, venues } from '../parts';
import { coverFor } from '../style-render';
import { AttireSection, GiftsSection } from '../event-parts';
import { legacyNotes } from '../event-view';

export default function Editorial({ details: d, scheme, photos: all, style, rsvpSlot, giftQr, events }: LayoutProps<InvitationDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  const n = legacyNotes(events, d.dressCode, d.giftsNote, giftQr);
  const places = venues(d);
  return (
    <main className="inv ed" style={{ ...schemeVars(scheme, style), ...displayVars(scheme) }}>
      <header {...heroAttrs('ed-hero', cover, scheme.primary)}>
        {cover && <Cover {...cover} />}
        <p className="ed-kicker ed-top"><span>The wedding issue</span><span>{formatDate(d.eventDate, { month: 'long', year: 'numeric' })}</span></p>
        <div>
          <p className="ed-kicker">Together with their families</p>
          <h1 className="ed-names"><span>{d.partner1}</span> <span className="ed-amp">&amp;</span> <span>{d.partner2}</span></h1>
          <p className="ed-dek">request the pleasure of your company as they marry</p>
        </div>
      </header>

      <div className="ed-band">
        <section aria-labelledby="ed-when">
          <h2 id="ed-when" className="ed-kicker">When</h2>
          <p className="ed-big">{longDate(d.eventDate)}</p>
          {d.eventTime && <p>{time12(d.eventTime)}</p>}
          <Countdown details={d} className="ed-countdown" />
        </section>
        {places.length > 0 && (
          <section aria-labelledby="ed-where">
            <h2 id="ed-where" className="ed-kicker">Where</h2>
            <p className="ed-big">{places[0][1].name}</p>
            {places[1] && <p>Reception to follow at {places[1][1].name}</p>}
          </section>
        )}
      </div>

      <div className="ed-body">
        {d.message && <p className="ed-lead">{d.message}</p>}

        {places.length > 0 && (
          <section className="ed-sec" aria-labelledby="ed-venues">
            <h2 id="ed-venues">The venues</h2>
            <div className="ed-cols">
              {places.map(([label, v]) => (
                <div key={label}>
                  <p className="ed-kicker">{label}</p>
                  <h3>{v.name}</h3>
                  {v.address && <p>{v.address}</p>}
                  <MapLink venue={v} />
                </div>
              ))}
            </div>
          </section>
        )}

        {d.schedule.length > 0 && (
          <section className="ed-sec" aria-labelledby="ed-program">
            <h2 id="ed-program">The programme</h2>
            <ol className="ed-schedule">
              {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(n.dress || n.gifts) && (
          <section className="ed-sec" aria-labelledby="ed-notes">
            <h2 id="ed-notes">Good to know</h2>
            <div className="ed-cols">
              {n.dress && <div><h3 className="ed-kicker">Attire</h3><p>{d.dressCode}</p></div>}
              {n.gifts && <div><h3 className="ed-kicker">Gifts</h3>{d.giftsNote && <p>{d.giftsNote}</p>}<GiftQr src={giftQr} /></div>}
            </div>
          </section>
        )}
        <AttireSection events={events} dressCode={d.dressCode} id="ed-attire" className="ed-sec" kicker="ed-kicker" />
        <GiftsSection events={events} note={d.giftsNote} qr={giftQr} id="ed-gifts" className="ed-sec" kicker="ed-kicker" />

        {photos.length > 0 && (
          <section className="ed-sec" aria-labelledby="ed-gallery">
            <h2 id="ed-gallery">Moments</h2>
            <Photos photos={photos} title={wedding.title(d)} className="ed-photos" />
          </section>
        )}

        {rsvpSlot && (
          <section className="ed-sec" aria-labelledby="ed-rsvp">
            <h2 id="ed-rsvp">Kindly reply</h2>
            {d.rsvpDeadline && <p className="ed-kicker">By {longDate(d.rsvpDeadline)}</p>}
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
