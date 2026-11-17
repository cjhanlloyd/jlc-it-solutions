// /reviews: every approved review with the average rating.
import React from 'react';
import { ReviewCard, Stars, summary, useReviews } from './Stars';
import { NavLink } from './NavLink';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

export default function ReviewsPage() {
  const [limit, setLimit] = React.useState(24);
  const data = useReviews(limit);
  const d = data && data !== 'offline' ? data : null;
  return (
    <div className="bg-ivory px-4 py-16 font-sans text-ink sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Reviews</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">Loved by our clients</h1>
          <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
          {d && d.average !== null && (
            <p className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-ink/80"><Stars rating={d.average} /> <span>{summary(d.average, d.count)}</span></p>
          )}
        </header>
        {data === null && <p role="status" className="text-center text-sm text-ink/80">Loading reviews…</p>}
        {data === 'offline' && <p className="text-center text-sm text-ink/80">We could not load the reviews. Please try again later.</p>}
        {d && d.reviews.length === 0 && <p className="text-center text-sm text-ink/80">No reviews yet.</p>}
        {d && d.reviews.length > 0 && <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{d.reviews.map((r, i) => <React.Fragment key={i}><ReviewCard r={r} /></React.Fragment>)}</ul>}
        {d && d.count > d.reviews.length && limit < 200 && (
          <div className="mt-10 text-center">
            <button type="button" onClick={() => setLimit((n) => Math.min(n + 24, 200))} className={`inline-flex min-h-11 items-center rounded-full border border-gold px-7 py-3 text-sm font-semibold text-ink hover:bg-sand ${focusRing}`}>Show more</button>
          </div>
        )}
        <p className="mt-12 text-center text-sm text-ink/80">Bought an invitation? <NavLink href="/account" className={`font-medium text-brand-700 underline underline-offset-4 ${focusRing}`}>Sign in to leave a review.</NavLink></p>
      </div>
    </div>
  );
}
