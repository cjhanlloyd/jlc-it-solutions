// Confetti: a bright kids' party look, gradient header with confetti dots, big age, theme pill, rounded heavy type and cards.
import type { LayoutProps } from '.';
import { birthday, type BirthdayDetails } from '../../../shared/occasions/birthday';
import { Cover, Countdown, MapLink, Ordinal, GiftQr, Photos, longDate, schemeVars, time12, heroAttrs } from '../parts';
import { coverFor } from '../style-render';
import { AttireSection, GiftsSection, GuestGallery } from '../event-parts';
import { legacyNotes } from '../event-view';

export default function Confetti({ details: d, scheme, photos: all, style, rsvpSlot, giftQr, events }: LayoutProps<BirthdayDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  const n = legacyNotes(events, d.dressCode, d.giftsNote, giftQr);
  return (
    <main className="inv cf" style={schemeVars(scheme, style)}>
      <header {...heroAttrs('cf-hero', cover, scheme.primary)}>
        {cover && <Cover {...cover} />}
        <span className="cf-dots" aria-hidden="true" />
        <p className="cf-kicker">You're invited to</p>
        <h1 className="cf-title">
          <span className="cf-name">{d.celebrant}'s</span>{' '}
          {d.age && <><span className="cf-age"><Ordinal n={d.age} /></span>{' '}</>}
          <span>Birthday Party!</span>
        </h1>
        {d.headline && <p className="cf-headline">{d.headline}</p>}
        {d.theme && <p className="cf-pill">Theme: {d.theme}</p>}
      </header>

      <div className="cf-wrap">
        <section className="cf-card cf-when" aria-label="When">
          <p className="cf-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
          <Countdown details={d} className="cf-countdown" />
        </section>

        {d.message && <p className="cf-card cf-message">{d.message}</p>}

        <section className="cf-card" aria-labelledby="cf-where">
          <h2 id="cf-where">Where</h2>
          <h3 className="cf-venue">{d.venue.name}</h3>
          {d.venue.address && <p>{d.venue.address}</p>}
          <MapLink venue={d.venue} />
        </section>

        {d.schedule.length > 0 && (
          <section className="cf-card" aria-labelledby="cf-program">
            <h2 id="cf-program">Party program</h2>
            <ol className="cf-schedule">
              {d.schedule.map((s, i) => <li key={i}><span className="cf-time">{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(n.dress || n.gifts) && (
          <section className="cf-card" aria-labelledby="cf-notes">
            <h2 id="cf-notes">Good to know</h2>
            {n.dress && <><h3 className="cf-small">Attire</h3><p>{d.dressCode}</p></>}
            {n.gifts && <><h3 className="cf-small">Gifts</h3>{d.giftsNote && <p>{d.giftsNote}</p>}<GiftQr src={giftQr} /></>}
          </section>
        )}
        <AttireSection events={events} dressCode={d.dressCode} id="cf-attire" className="cf-card" kicker="cf-small" />
        <GiftsSection events={events} note={d.giftsNote} qr={giftQr} id="cf-gifts" className="cf-card" kicker="cf-small" />

        <Photos photos={photos} title={birthday.title(d)} className="cf-photos" layout={events?.galleryLayout} />
        <GuestGallery events={events} kicker="cf-small" className="cf-card" />

        {d.hostedBy && (
          <section className="cf-card" aria-labelledby="cf-host">
            <h2 id="cf-host">Hosted by</h2>
            <p>{d.hostedBy}</p>
          </section>
        )}

        {rsvpSlot && (
          <section className="cf-card" aria-labelledby="cf-rsvp">
            <h2 id="cf-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
