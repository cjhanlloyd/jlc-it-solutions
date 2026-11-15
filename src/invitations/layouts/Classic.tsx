// Classic: formal and centered, serif type, double-ruled frame and ornamental dividers.
import type { LayoutProps } from '.';
import type { InvitationDetails } from '../../../shared/occasions/wedding';
import { Countdown, MapLink, Ornament, Photos, longDate, schemeVars, time12, venues } from '../parts';

export default function Classic({ details: d, scheme, photos, rsvpSlot }: LayoutProps<InvitationDetails>) {
  const divider = <Ornament className="cl-orn" />;
  return (
    <main className="inv cl" style={schemeVars(scheme)}>
      <div className="cl-frame">
        <header>
          <p className="cl-kicker">Together with their families</p>
          <h1 className="cl-names">
            <span>{d.partner1}</span> <span className="cl-amp">&amp;</span> <span>{d.partner2}</span>
          </h1>
          <p className="cl-italic">request the honour of your presence at the celebration of their marriage</p>
          {divider}
          <p className="cl-date">{longDate(d.eventDate)}</p>
          {d.eventTime && <p className="cl-italic">at {time12(d.eventTime)}</p>}
          <Countdown details={d} className="cl-countdown" />
        </header>

        {d.message && <>{divider}<p className="cl-italic cl-message">{d.message}</p></>}

        {divider}
        <section aria-labelledby="cl-where">
          <h2 id="cl-where">Where</h2>
          <div className="cl-venues">
            {venues(d).map(([label, v]) => (
              <div key={label}>
                <p className="cl-kicker">{label}</p>
                <h3>{v.name}</h3>
                {v.address && <p>{v.address}</p>}
                <MapLink venue={v} />
              </div>
            ))}
          </div>
        </section>

        {d.schedule.length > 0 && (
          <section aria-labelledby="cl-order">
            {divider}
            <h2 id="cl-order">Order of the day</h2>
            <ol className="cl-schedule">
              {d.schedule.map((s, i) => (
                <li key={i}><span>{time12(s.time)}</span><span className="cl-leader" aria-hidden="true" /><span>{s.label}</span></li>
              ))}
            </ol>
          </section>
        )}

        {(d.dressCode || d.giftsNote) && (
          <section aria-labelledby="cl-notes">
            {divider}
            <h2 id="cl-notes">Good to know</h2>
            {d.dressCode && <><h3 className="cl-kicker">Attire</h3><p>{d.dressCode}</p></>}
            {d.giftsNote && <><h3 className="cl-kicker">Gifts</h3><p>{d.giftsNote}</p></>}
          </section>
        )}

        {photos.length > 0 && <>{divider}<Photos photos={photos} title={`${d.partner1} and ${d.partner2}`} className="cl-photos" /></>}

        {rsvpSlot && (
          <section aria-labelledby="cl-rsvp">
            {divider}
            <h2 id="cl-rsvp">Kindly reply</h2>
            {d.rsvpDeadline && <p className="cl-italic">by {longDate(d.rsvpDeadline)}</p>}
            {rsvpSlot}
          </section>
        )}
      </div>
    </main>
  );
}
