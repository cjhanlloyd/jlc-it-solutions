// Modern: minimal and asymmetric, bold sans type, a color bar, labelled rows and an offset feature photo.
import type { LayoutProps } from '.';
import { Countdown, MapLink, Photos, formatDate, longDate, photoAlt, schemeVars, time12, venues } from '../parts';

export default function Modern({ details: d, scheme, photos, rsvpSlot }: LayoutProps) {
  return (
    <main className="inv md" style={schemeVars(scheme)}>
      <header className="md-hero">
        <p className="md-label">The wedding of</p>
        <h1 className="md-names">
          <span>{d.partner1}</span> <span className="md-amp">&amp;</span> <span>{d.partner2}</span>
        </h1>
        <p className="md-date">
          <span className="md-day">{formatDate(d.eventDate, { day: '2-digit' })}</span>
          <span className="md-month">
            <span>{formatDate(d.eventDate, { month: 'long', year: 'numeric' })}</span>
            <span>{formatDate(d.eventDate, { weekday: 'long' })}{d.eventTime && ` · ${time12(d.eventTime)}`}</span>
          </span>
        </p>
        <Countdown details={d} className="md-countdown" />
      </header>

      {photos[0] && <img className="md-feature" src={photos[0]} alt={photoAlt(d, 0, photos.length)} loading="lazy" decoding="async" />}

      <div className="md-body">
        {d.message && <p className="md-lead">{d.message}</p>}

        {venues(d).map(([label, v]) => (
          <section key={label} className="md-row" aria-labelledby={`md-${label}`}>
            <h2 id={`md-${label}`} className="md-label">{label}</h2>
            <div>
              <h3 className="md-venue">{v.name}</h3>
              {v.address && <p>{v.address}</p>}
              <MapLink venue={v} />
            </div>
          </section>
        ))}

        {d.schedule.length > 0 && (
          <section className="md-row" aria-labelledby="md-schedule">
            <h2 id="md-schedule" className="md-label">Schedule</h2>
            <ol className="md-schedule">
              {d.schedule.map((s, i) => <li key={i}><span className="md-time">{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {d.dressCode && (
          <section className="md-row" aria-labelledby="md-attire">
            <h2 id="md-attire" className="md-label">Attire</h2>
            <p>{d.dressCode}</p>
          </section>
        )}
        {d.giftsNote && (
          <section className="md-row" aria-labelledby="md-gifts">
            <h2 id="md-gifts" className="md-label">Gifts</h2>
            <p>{d.giftsNote}</p>
          </section>
        )}

        {photos.length > 1 && (
          <section className="md-row" aria-labelledby="md-moments">
            <h2 id="md-moments" className="md-label">Moments</h2>
            <Photos photos={photos} start={1} details={d} className="md-photos" />
          </section>
        )}

        {rsvpSlot && (
          <section className="md-row" aria-labelledby="md-rsvp">
            <h2 id="md-rsvp" className="md-label">RSVP</h2>
            <div>
              {d.rsvpDeadline && <p className="md-strong">Reply by {longDate(d.rsvpDeadline)}</p>}
              {rsvpSlot}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
