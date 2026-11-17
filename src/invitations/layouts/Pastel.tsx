// Pastel: a soft, playful birthday. A gentle scheme gradient with CSS blobs behind rounded cards and a big friendly age.
// All text sits on the scheme background inside the cards, so it keeps the scheme's contrast.
import type { LayoutProps } from '.';
import { birthday, type BirthdayDetails } from '../../../shared/occasions/birthday';
import { Cover, Countdown, displayVars, MapLink, Ordinal, GiftQr, Photos, heroAttrs, longDate, schemeVars, time12 } from '../parts';
import { coverFor } from '../style-render';

export default function Pastel({ details: d, scheme, photos: all, style, rsvpSlot, giftQr }: LayoutProps<BirthdayDetails>) {
  const { cover, gallery: photos } = coverFor(style, all);
  return (
    <main className="inv ps" style={{ ...schemeVars(scheme, style), ...displayVars(scheme) }}>
      <header {...heroAttrs('ps-hero', cover, scheme.primary)}>
        {cover && <Cover {...cover} />}
        <p className="ps-kicker">{d.headline || "You're invited"}</p>
        {d.age && <p className="ps-age"><span><Ordinal n={d.age} /></span></p>}
        <h1 className="ps-name">{d.celebrant}</h1>
        <p className="ps-sub">{d.age ? 'birthday party' : 'birthday celebration'}</p>
        {d.theme && <p className="ps-pill">Theme: {d.theme}</p>}
      </header>

      <section className="ps-card" aria-label="When">
        <p className="ps-date">{longDate(d.eventDate)}{d.eventTime && ` · ${time12(d.eventTime)}`}</p>
        <Countdown details={d} className="ps-countdown" />
      </section>

      {d.message && <p className="ps-card ps-message">{d.message}</p>}

      <section className="ps-card" aria-labelledby="ps-where">
        <h2 id="ps-where">Where</h2>
        <h3 className="ps-venue">{d.venue.name}</h3>
        {d.venue.address && <p>{d.venue.address}</p>}
        <MapLink venue={d.venue} />
      </section>

      {d.schedule.length > 0 && (
        <section className="ps-card" aria-labelledby="ps-program">
          <h2 id="ps-program">Party program</h2>
          <ol className="ps-schedule">
            {d.schedule.map((s, i) => <li key={i}><span>{time12(s.time)}</span><span>{s.label}</span></li>)}
          </ol>
        </section>
      )}

      {(d.dressCode || d.giftsNote || giftQr) && (
        <section className="ps-card" aria-labelledby="ps-notes">
          <h2 id="ps-notes">Good to know</h2>
          {d.dressCode && <><h3 className="ps-small">Attire</h3><p>{d.dressCode}</p></>}
          {(d.giftsNote || giftQr) && <><h3 className="ps-small">Gifts</h3>{d.giftsNote && <p>{d.giftsNote}</p>}<GiftQr src={giftQr} /></>}
        </section>
      )}

      <Photos photos={photos} title={birthday.title(d)} className="ps-photos" />

      {d.hostedBy && (
        <section className="ps-card" aria-labelledby="ps-host">
          <h2 id="ps-host">Hosted by</h2>
          <p>{d.hostedBy}</p>
        </section>
      )}

      {rsvpSlot && (
        <section className="ps-card" aria-labelledby="ps-rsvp">
          <h2 id="ps-rsvp">Kindly reply{d.rsvpDeadline && ` by ${longDate(d.rsvpDeadline)}`}</h2>
          {rsvpSlot}
        </section>
      )}
    </main>
  );
}
