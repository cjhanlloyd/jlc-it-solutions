// Garden: soft and botanical, leafy sprigs, rounded cards, a vine timeline and arched photos.
import type { LayoutProps } from '.';
import type { InvitationDetails } from '../../../shared/occasions/wedding';
import { Cover, Countdown, MapLink, GiftQr, Photos, longDate, schemeVars, time12, venues, heroAttrs } from '../parts';
import { coverFor } from '../style-render';
import { AttireSection, GiftsSection } from '../event-parts';
import { legacyNotes } from '../event-view';

const LEAVES: [number, number, number][] = [[46, 37, -50], [70, 33, 35], [100, 24, -40], [126, 23, 40], [156, 13, -35], [176, 12, 30]];

const Sprig = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 220 60" aria-hidden="true" focusable="false">
    <path d="M14 50C60 40 120 34 204 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    {LEAVES.map(([x, y, r]) => (
      <ellipse key={x} cx={x} cy={y} rx="11" ry="4.6" fill="currentColor" opacity="0.75" transform={`rotate(${r} ${x} ${y})`} />
    ))}
    <g fill="var(--a)"><circle cx="30" cy="40" r="3" /><circle cx="38" cy="48" r="2.4" /><circle cx="204" cy="8" r="3" /></g>
  </svg>
);

export default function Garden({ details: d, scheme, photos: all, style, rsvpSlot, giftQr, events }: LayoutProps<InvitationDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  const n = legacyNotes(events, d.dressCode, d.giftsNote, giftQr);
  return (
    <main className="inv gd" style={schemeVars(scheme, style)}>
      <div className="gd-wrap">
        <header {...heroAttrs('gd-hero', cover, scheme.primary)}>
          {cover && <Cover {...cover} />}
          <Sprig className="gd-sprig" />
          <p className="gd-kicker">You are warmly invited to the wedding of</p>
          <h1 className="gd-names">
            <span>{d.partner1}</span> <span className="gd-amp">&amp;</span> <span>{d.partner2}</span>
          </h1>
          <p className="gd-date">{longDate(d.eventDate)}{d.eventTime && <><br />{time12(d.eventTime)}</>}</p>
          <Countdown details={d} className="gd-countdown" />
        </header>

        {d.message && <p className="gd-card gd-message">{d.message}</p>}

        <section className="gd-card" aria-labelledby="gd-where">
          <h2 id="gd-where">Where to find us</h2>
          {venues(d).map(([label, v]) => (
            <div key={label} className="gd-venue">
              <h3><span className="gd-small">{label}</span>{v.name}</h3>
              {v.address && <p>{v.address}</p>}
              <MapLink venue={v} />
            </div>
          ))}
        </section>

        {d.schedule.length > 0 && (
          <section className="gd-card" aria-labelledby="gd-day">
            <h2 id="gd-day">The day</h2>
            <ol className="gd-timeline">
              {d.schedule.map((s, i) => <li key={i}><span className="gd-small">{time12(s.time)}</span>{s.label}</li>)}
            </ol>
          </section>
        )}

        {(n.dress || n.gifts) && (
          <section className="gd-card" aria-labelledby="gd-notes">
            <h2 id="gd-notes">A few notes</h2>
            {n.dress && <p><span className="gd-small">Attire</span>{d.dressCode}</p>}
            {n.gifts && <><p><span className="gd-small">Gifts</span>{d.giftsNote}</p><GiftQr src={giftQr} /></>}
          </section>
        )}
        <AttireSection events={events} dressCode={d.dressCode} id="gd-attire" className="gd-card" kicker="gd-small" />
        <GiftsSection events={events} note={d.giftsNote} qr={giftQr} id="gd-gifts" className="gd-card" kicker="gd-small" />

        <Photos photos={photos} title={`${d.partner1} and ${d.partner2}`} className="gd-photos" />

        {rsvpSlot && (
          <section className="gd-card" aria-labelledby="gd-rsvp">
            <h2 id="gd-rsvp">Will you join us?</h2>
            {d.rsvpDeadline && <p>Please reply by {longDate(d.rsvpDeadline)}.</p>}
            {rsvpSlot}
          </section>
        )}

        <Sprig className="gd-sprig gd-sprig-end" />
      </div>
    </main>
  );
}
