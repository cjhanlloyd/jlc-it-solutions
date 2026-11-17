// Minimal: an airy, sans-led wedding. Light type, small-caps kickers, hairline dividers and lots of space;
// a cover photo sits as an inset framed hero rather than full-bleed.
import type { LayoutProps } from '.';
import { wedding, type InvitationDetails } from '../../../shared/occasions/wedding';
import { Cover, Countdown, displayVars, MapLink, GiftQr, Photos, heroAttrs, longDate, schemeVars, time12, venues } from '../parts';
import { coverFor } from '../style-render';

export default function Minimal({ details: d, scheme, photos: all, style, rsvpSlot, giftQr }: LayoutProps<InvitationDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  const places = venues(d);
  return (
    <main className="inv mn" style={{ ...schemeVars(scheme, style), ...displayVars(scheme) }}>
      <header {...heroAttrs('mn-hero', cover, scheme.primary)}>
        {cover && <Cover {...cover} />}
        <p className="mn-kicker">Together with their families</p>
        <h1 className="mn-names"><span>{d.partner1}</span> <span className="mn-amp">&amp;</span> <span>{d.partner2}</span></h1>
        <p>invite you to celebrate their wedding</p>
        <hr className="mn-rule" />
        <p className="mn-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
      </header>

      <div className="mn-body">
        <Countdown details={d} className="mn-countdown" />

        {d.message && <p className="mn-sec mn-big">{d.message}</p>}

        {places.length > 0 && (
          <section className="mn-sec" aria-labelledby="mn-where">
            <h2 id="mn-where">Where</h2>
            {places.map(([label, v]) => (
              <div key={label} className="mn-venue">
                <p className="mn-kicker">{label}</p>
                <h3>{v.name}</h3>
                {v.address && <p>{v.address}</p>}
                <MapLink venue={v} />
              </div>
            ))}
          </section>
        )}

        {d.schedule.length > 0 && (
          <section className="mn-sec" aria-labelledby="mn-program">
            <h2 id="mn-program">Program</h2>
            <ol className="mn-schedule">
              {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
            </ol>
          </section>
        )}

        {(d.dressCode || d.giftsNote || giftQr) && (
          <section className="mn-sec" aria-labelledby="mn-notes">
            <h2 id="mn-notes">Good to know</h2>
            {d.dressCode && <><h3 className="mn-kicker">Attire</h3><p>{d.dressCode}</p></>}
            {(d.giftsNote || giftQr) && <><h3 className="mn-kicker">Gifts</h3>{d.giftsNote && <p>{d.giftsNote}</p>}<GiftQr src={giftQr} /></>}
          </section>
        )}

        {photos.length > 0 && (
          <div className="mn-sec">
            <Photos photos={photos} title={wedding.title(d)} className="mn-photos" />
          </div>
        )}

        {rsvpSlot && (
          <section className="mn-sec" aria-labelledby="mn-rsvp">
            <h2 id="mn-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
