// Blush: an elegant debut look, soft scheme background, italic serif name under a big "18", named tradition lists.
import type { LayoutProps } from '.';
import { TRADITIONS, debut, type DebutDetails } from '../../../shared/occasions/debut';
import { Countdown, MapLink, Photos, longDate, schemeVars, time12 } from '../parts';

export default function Blush({ details: d, scheme, photos, rsvpSlot }: LayoutProps<DebutDetails>) {
  const traditions = TRADITIONS.filter((t) => d[t.key]?.length);
  return (
    <main className="inv bl" style={schemeVars(scheme)}>
      <div className="bl-wrap">
        <header className="bl-hero">
          <p className="bl-kicker">{d.headline || 'Please join us to celebrate the debut of'}</p>
          <div className="bl-age" aria-hidden="true">18</div>
          <h1 className="bl-name">{d.debutante}</h1>
          {d.theme && <p className="bl-kicker">{d.theme}</p>}
          <p className="bl-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
          <Countdown details={d} className="bl-countdown" />
        </header>

        {d.message && <p className="bl-message">{d.message}</p>}

        <section aria-labelledby="bl-where">
          <h2 id="bl-where">Where</h2>
          <h3 className="bl-venue">{d.venue.name}</h3>
          {d.venue.address && <p>{d.venue.address}</p>}
          <MapLink venue={d.venue} />
        </section>

        {d.schedule.length > 0 && (
          <section aria-labelledby="bl-program">
            <h2 id="bl-program">Program</h2>
            <ol className="bl-schedule">
              {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(d.escort || traditions.length > 0) && (
          <section aria-labelledby="bl-court">
            <h2 id="bl-court">The court</h2>
            {d.escort && <><h3 className="bl-kicker">Escort</h3><p className="bl-escort">{d.escort}</p></>}
            {traditions.map((t) => (
              <div key={t.key} className="bl-list">
                <h3 className="bl-kicker">{t.label}</h3>
                <ol>{d[t.key]!.map((n, i) => <li key={i}>{n}</li>)}</ol>
              </div>
            ))}
          </section>
        )}

        {(d.dressCode || d.giftsNote) && (
          <section aria-labelledby="bl-notes">
            <h2 id="bl-notes">Good to know</h2>
            {d.dressCode && <><h3 className="bl-kicker">Attire</h3><p>{d.dressCode}</p></>}
            {d.giftsNote && <><h3 className="bl-kicker">Gifts</h3><p>{d.giftsNote}</p></>}
          </section>
        )}

        <Photos photos={photos} title={debut.title(d)} className="bl-photos" />

        {d.hostedBy && (
          <section aria-labelledby="bl-host">
            <h2 id="bl-host">Hosted by</h2>
            <p className="bl-italic">{d.hostedBy}</p>
          </section>
        )}

        {rsvpSlot && (
          <section aria-labelledby="bl-rsvp">
            <h2 id="bl-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
