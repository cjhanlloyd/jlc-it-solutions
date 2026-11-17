// Homepage hero showcase: every active design as a swipeable slide (native scroll-snap), with arrows, dots and keyboard support.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Design } from './designs-api';
import { LivePreview, hasFrom } from './DesignCard';
import { NavLink } from './NavLink';
import { peso } from '../invitations/kit';
import { occasionLabel } from '../invitations/occasions';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const arrowBtn = `absolute top-[38%] z-10 hidden -translate-y-1/2 rounded-full border border-gold-light bg-white/95 p-2.5 text-ink shadow-card hover:bg-sand disabled:opacity-0 sm:inline-flex ${focusRing}`;

export default function DesignShowcase({ designs }: { designs: Design[] }) {
  const track = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  // The slide nearest the track's left edge is the current one.
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.children.length) return;
    const w = (el.children[0] as HTMLElement).offsetWidth;
    setActive(Math.min(designs.length - 1, Math.max(0, Math.round(el.scrollLeft / w))));
  };
  const go = (i: number) => {
    const el = track.current;
    const slide = el?.children[Math.min(designs.length - 1, Math.max(0, i))] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  };

  return (
    <section className="relative mx-auto w-full min-w-0 max-w-sm" aria-roledescription="carousel" aria-label="Invitation designs">
      <ul ref={track} onScroll={onScroll} onKeyDown={onKey}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {designs.map((d, i) => (
          <li key={d.slug} className="w-full shrink-0 snap-start px-1 pb-2" aria-roledescription="slide" aria-label={`${i + 1} of ${designs.length}: ${d.name}`}>
            <article className="overflow-hidden rounded-card border border-gold-light bg-white shadow-card">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                {d.previewImages[0]
                  ? <img src={d.previewImages[0]} alt={`${d.name} invitation design`} loading={i === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />
                  : <LivePreview design={d} eager={Math.abs(i - active) <= 1} />}
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-gold-light p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{occasionLabel(d.productType)}</p>
                  <h2 className="truncate font-serif text-2xl font-semibold leading-tight text-ink">
                    <NavLink href={`/designs/${encodeURIComponent(d.slug)}`} className={`hover:underline ${focusRing}`}>{d.name}</NavLink>
                  </h2>
                  <p className="text-sm text-ink/80">{hasFrom(d) && 'From '}{peso(d.fromPriceCentavos)}</p>
                </div>
                <NavLink href={`/designs/${encodeURIComponent(d.slug)}/customise`}
                  className={`shrink-0 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 ${focusRing}`}>
                  Customise<span className="sr-only"> {d.name}</span>
                </NavLink>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {designs.length > 1 && (
        <>
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous design" className={`${arrowBtn} -left-5`}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === designs.length - 1} aria-label="Next design" className={`${arrowBtn} -right-5`}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {designs.map((d, i) => (
              <button key={d.slug} type="button" onClick={() => go(i)} aria-label={`Show ${d.name}`} aria-current={i === active ? 'true' : undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${focusRing}`}>
                <span className={`block h-2 rounded-full transition-all ${i === active ? 'w-5 bg-brand-700' : 'w-2 bg-gold-light'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
