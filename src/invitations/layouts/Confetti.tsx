// Confetti: a bright kids' party look, gradient header with confetti dots, big age, theme pill, rounded heavy type and cards.
import type { LayoutProps } from '.';
import { birthday, type BirthdayDetails } from '../../../shared/occasions/birthday';
import { Countdown, MapLink, Ordinal, Photos, longDate, schemeVars, time12 } from '../parts';

export default function Confetti({ details: d, scheme, photos, rsvpSlot }: LayoutProps<BirthdayDetails>) {
  return (
    <main className="inv cf" style={schemeVars(scheme)}>
      <header className="cf-hero">
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

        {(d.dressCode || d.giftsNote) && (
          <section className="cf-card" aria-labelledby="cf-notes">
            <h2 id="cf-notes">Good to know</h2>
            {d.dressCode && <><h3 className="cf-small">Attire</h3><p>{d.dressCode}</p></>}
            {d.giftsNote && <><h3 className="cf-small">Gifts</h3><p>{d.giftsNote}</p></>}
          </section>
        )}

        <Photos photos={photos} title={birthday.title(d)} className="cf-photos" />

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
