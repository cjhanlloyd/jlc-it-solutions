// Starlight: an evening debut. The scheme is turned to night (text colour as the sky, background as the ink),
// with a CSS star field, a glowing serif name, an elegant "18" and gold accents from the scheme accent.
import type { LayoutProps } from '.';
import { TRADITIONS, debut, type DebutDetails } from '../../../shared/occasions/debut';
import { Cover, Countdown, displayVars, MapLink, Photos, heroAttrs, longDate, schemeVars, time12 } from '../parts';
import { coverFor } from '../style-render';

export default function Starlight({ details: d, scheme, photos: all, style, rsvpSlot }: LayoutProps<DebutDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  const traditions = TRADITIONS.filter((t) => d[t.key]?.length);
  return (
    <main className="inv st" style={{ ...schemeVars(scheme, style), ...displayVars(scheme) }}>
      <div className="st-sky">
        <header {...heroAttrs('st-hero', cover, scheme.primary)}>
          {cover && <Cover {...cover} />}
          <span className="st-stars" aria-hidden="true" />
          <p className="st-kicker">{d.headline || 'Please join us to celebrate the debut of'}</p>
          <div className="st-age" aria-hidden="true">18</div>
          <h1 className="st-name">{d.debutante}</h1>
          {d.theme && <p className="st-kicker">{d.theme}</p>}
          <p className="st-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
          <Countdown details={d} className="st-countdown" />
        </header>

        <div className="st-wrap">
          {d.message && <p className="st-message">{d.message}</p>}

          <section aria-labelledby="st-where">
            <h2 id="st-where">Where</h2>
            <h3 className="st-venue">{d.venue.name}</h3>
            {d.venue.address && <p>{d.venue.address}</p>}
            <MapLink venue={d.venue} />
          </section>

          {d.schedule.length > 0 && (
            <section aria-labelledby="st-program">
              <h2 id="st-program">Program</h2>
              <ol className="st-schedule">
                {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
              </ol>
            </section>
          )}

          {(d.escort || traditions.length > 0) && (
            <section aria-labelledby="st-court">
              <h2 id="st-court">The court</h2>
              {d.escort && <><h3 className="st-kicker">Escort</h3><p className="st-escort">{d.escort}</p></>}
              {traditions.map((t) => (
                <div key={t.key} className="st-list">
                  <h3 className="st-kicker">{t.label}</h3>
                  <ol>{d[t.key]!.map((n, i) => <li key={i}>{n}</li>)}</ol>
                </div>
              ))}
            </section>
          )}

          {(d.dressCode || d.giftsNote) && (
            <section aria-labelledby="st-notes">
              <h2 id="st-notes">Good to know</h2>
              {d.dressCode && <><h3 className="st-kicker">Attire</h3><p>{d.dressCode}</p></>}
              {d.giftsNote && <><h3 className="st-kicker">Gifts</h3><p>{d.giftsNote}</p></>}
            </section>
          )}

          <Photos photos={photos} title={debut.title(d)} className="st-photos" />

          {d.hostedBy && (
            <section aria-labelledby="st-host">
              <h2 id="st-host">Hosted by</h2>
              <p className="st-escort">{d.hostedBy}</p>
            </section>
          )}

          {rsvpSlot && (
            <section aria-labelledby="st-rsvp">
              <h2 id="st-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
              {rsvpSlot}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
