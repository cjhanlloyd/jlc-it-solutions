// Golden: an elegant milestone look, dark scheme background, gold accent rules, serif type, centred, big age.
import type { LayoutProps } from '.';
import { birthday, type BirthdayDetails } from '../../../shared/occasions/birthday';
import { Countdown, MapLink, Ordinal, Photos, longDate, schemeVars, time12 } from '../parts';

export default function Golden({ details: d, scheme, photos, rsvpSlot }: LayoutProps<BirthdayDetails>) {
  return (
    <main className="inv gl" style={schemeVars(scheme)}>
      <div className="gl-wrap">
        <header className="gl-hero">
          <p className="gl-kicker">You're invited to</p>
          <h1 className="gl-title">
            <span className="gl-name">{d.celebrant}'s</span>{' '}
            {d.age && <><span className="gl-age"><Ordinal n={d.age} /></span>{' '}</>}
            <span className="gl-kicker">Birthday</span>
          </h1>
          {d.headline && <p className="gl-italic">{d.headline}</p>}
          <p className="gl-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
          <Countdown details={d} className="gl-countdown" />
        </header>

        {d.message && <p className="gl-italic gl-message">{d.message}</p>}

        <section aria-labelledby="gl-where">
          <h2 id="gl-where">Where</h2>
          <h3 className="gl-venue">{d.venue.name}</h3>
          {d.venue.address && <p>{d.venue.address}</p>}
          <MapLink venue={d.venue} />
        </section>

        {d.schedule.length > 0 && (
          <section aria-labelledby="gl-program">
            <h2 id="gl-program">Program</h2>
            <ol className="gl-schedule">
              {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(d.dressCode || d.giftsNote) && (
          <section aria-labelledby="gl-notes">
            <h2 id="gl-notes">Good to know</h2>
            {d.dressCode && <><h3 className="gl-kicker">Attire</h3><p>{d.dressCode}</p></>}
            {d.giftsNote && <><h3 className="gl-kicker">Gifts</h3><p>{d.giftsNote}</p></>}
          </section>
        )}

        <Photos photos={photos} title={birthday.title(d)} className="gl-photos" />

        {d.hostedBy && (
          <section aria-labelledby="gl-host">
            <h2 id="gl-host">Hosted by</h2>
            <p className="gl-italic">{d.hostedBy}</p>
          </section>
        )}

        {rsvpSlot && (
          <section aria-labelledby="gl-rsvp">
            <h2 id="gl-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
