// Homepage hero showcase: every active design as a stacked, swipeable deck. The front card follows the finger; a swipe left
// sends it off to the left and brings the next one forward, a swipe right brings the previous one back in. Arrows, dots and
// arrow keys do the same on desktop. Only the front three cards render a live preview.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Design } from './designs-api';
import { LivePreview, PremiumBadge, hasFrom } from './DesignCard';
import { isPremium } from './design-tier';
import { NavLink } from './NavLink';
import { peso } from '../invitations/kit';
import { occasionLabel } from '../invitations/occasions';
import { BACK, cardPose } from './deck-pose';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const SWIPE_PX = 70; // drag distance that commits a swipe


export default function DesignShowcase({ designs }: { designs: Design[] }) {
  const n = designs.length;
  const [index, setIndex] = React.useState(0);
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef<{ x: number; y: number; id: number; moved: boolean; axis: 'x' | 'y' | null } | null>(null);
  const wrap = (i: number) => ((i % n) + n) % n;
  const go = (step: number) => { setIndex((i) => wrap(i + step)); setDx(0); };

  const onPointerDown = (e: React.PointerEvent) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.axis && Math.hypot(mx, my) > 6) {
      d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (d.axis === 'x') { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } setDragging(true); }
    }
    if (d.axis === 'x') { d.moved = true; setDx(mx); }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = d.moved ? { ...d, id: -1 } : null; // keep "moved" until the click that follows is swallowed
    setDragging(false);
    if (dx <= -SWIPE_PX) go(1);
    else if (dx >= SWIPE_PX) go(-1);
    else setDx(0);
  };
  // A drag ends with a click on whatever was under the finger: don't follow that link
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); }
    drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  const current = designs[index];
  return (
    <section className="relative mx-auto w-full min-w-0 max-w-sm select-none" aria-roledescription="carousel" aria-label="Invitation designs" onKeyDown={onKeyDown}>
      <div className="relative aspect-[2/3] w-full" style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onClickCapture}>
        {designs.map((d, k) => {
          const o = wrap(k - index);
          const front = o === 0;
          const shown = front || (o <= BACK) || (n >= 3 && o === n - 1);
          const pose = cardPose(o, n, front ? dx : 0);
          return (
            <article key={d.slug} aria-hidden={!front} inert={!front}
              className={`absolute inset-y-0 left-0 right-7 flex flex-col overflow-hidden rounded-card border border-gold-light bg-white shadow-card ${front ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'} ${dragging && front ? '' : 'transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none'}`}
              style={{ transform: pose.transform, opacity: pose.opacity, zIndex: pose.z, visibility: shown ? 'visible' : 'hidden', willChange: o <= 1 ? 'transform' : undefined }}>
              <div className="relative flex-1 overflow-hidden bg-sand">
                {d.previewImages[0]
                  ? <img src={d.previewImages[0]} alt={`${d.name} invitation design`} loading={o <= 1 ? 'eager' : 'lazy'} draggable={false} className="h-full w-full object-cover" />
                  : (o <= BACK || o === n - 1) && <LivePreview design={d} eager />}
                {isPremium(d) && <PremiumBadge className="absolute left-3 top-3" />}
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-gold-light p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{occasionLabel(d.productType)}</p>
                  <h2 className="truncate font-serif text-2xl font-semibold leading-tight text-ink">
                    <NavLink href={`/designs/${encodeURIComponent(d.slug)}`} className={`hover:underline ${focusRing}`} draggable={false}>{d.name}</NavLink>
                  </h2>
                  <p className="text-sm text-ink/80">{hasFrom(d) && 'From '}{peso(d.fromPriceCentavos)}</p>
                </div>
                <NavLink href={`/designs/${encodeURIComponent(d.slug)}/customise`} draggable={false}
                  className={`shrink-0 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 ${focusRing}`}>
                  Customise<span className="sr-only"> {d.name}</span>
                </NavLink>
              </div>
            </article>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">{`${index + 1} of ${n}: ${current.name}`}</p>
      {n > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} aria-label="Previous design"
            className={`rounded-full border border-gold-light bg-white p-2.5 text-ink shadow-card hover:bg-sand ${focusRing}`}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex flex-wrap justify-center gap-0.5">
            {designs.map((d, i) => (
              <button key={d.slug} type="button" onClick={() => { setIndex(i); setDx(0); }} aria-label={`Show ${d.name}`} aria-current={i === index ? 'true' : undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${focusRing}`}>
                <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-brand-700' : 'w-1.5 bg-gold'}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(1)} aria-label="Next design"
            className={`rounded-full border border-gold-light bg-white p-2.5 text-ink shadow-card hover:bg-sand ${focusRing}`}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
      {n > 1 && <p className="mt-3 text-center text-xs tracking-wide text-ink/70 sm:hidden" aria-hidden="true">Swipe to explore the designs</p>}
    </section>
  );
}
