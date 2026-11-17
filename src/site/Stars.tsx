// Star rating (decorative SVG, text alternative on the wrapper) and the public review card. Review text is a plain React text node.
import React from 'react';

export type PublicReview = { displayName: string; rating: number; body: string; date: string };

export function Stars({ rating, className = 'h-5 w-5' }: { rating: number; className?: string }) {
  return (
    <span role="img" aria-label={`Rated ${rating} out of 5`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" aria-hidden="true" className={`${className} ${n <= Math.round(rating) ? 'fill-gold' : 'fill-none'} stroke-gold`} strokeWidth="1.5">
          <path strokeLinejoin="round" d="M10 1.8l2.4 5 5.4.7-4 3.8 1 5.4L10 14.1 5.2 16.7l1-5.4-4-3.8 5.4-.7z" />
        </svg>
      ))}
    </span>
  );
}

export const reviewDate = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' });

export function ReviewCard({ r }: { r: PublicReview }) {
  return (
    <li className="flex flex-col rounded-card border border-gold-light bg-white p-6 shadow-card">
      <Stars rating={r.rating} />
      <p className="mt-4 flex-1 whitespace-pre-line break-words text-base leading-relaxed text-ink">{r.body}</p>
      <p className="mt-5 text-sm"><span className="block break-words font-semibold text-ink">{r.displayName}</span><span className="text-ink/80">{reviewDate(r.date)}</span></p>
    </li>
  );
}

export function useReviews(limit: number) {
  const [data, setData] = React.useState<{ average: number | null; count: number; reviews: PublicReview[] } | null | 'offline'>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`/api/reviews?limit=${limit}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setData, () => setData('offline'));
  }, [limit]);
  return data;
}

export const summary = (average: number, count: number) => `${average.toFixed(1)} from ${count} ${count === 1 ? 'review' : 'reviews'}`;
