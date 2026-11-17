// A design in a grid: its preview (image, or a scaled live render of the sample), name, occasion and price; the whole card links to /designs/<slug>.
import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { Design } from './designs-api';
import { NavLink } from './NavLink';
import { peso, useInvitationFonts } from '../invitations/kit';
import { formOf } from '../invitations/forms';
import { occasionLabel } from '../invitations/occasions';
import { isPremium } from './design-tier';
import { sampleStyle } from '../../shared/invitation-style';

const InvitationView = React.lazy(() => import('../invitations/InvitationView'));

// Same normalising the customiser preview does, so layouts get a complete details object.
export const sampleOf = (d: { productType: string; sampleDetails: any }) => {
  const f = formOf(d.productType);
  return f ? f.preview(f.toDraft(d.sampleDetails), f.toDraft(d.sampleDetails)) : d.sampleDetails;
};

// "From" when the price depends on the package chosen.
export const hasFrom = (d: Design) => d.packages.filter((p) => p.kind === 'template').length > 1 || d.packages.some((p) => p.kind === 'custom');

// Gold-on-ink pill (about 10:1 contrast); sits over the top-left of a preview.
export const PremiumBadge = ({ className = '' }: { className?: string }) => (
  <span className={`rounded-full bg-ink/90 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-light ${className}`}>Premium</span>
);

const RENDER_WIDTH = 400; // the layout renders at phone width, then scales to the frame

// eager: mount now (the hero showcase passes it for the visible slide and its neighbours, which a horizontal scroller hides from the observer).
export function LivePreview({ design, eager = false }: { design: Design; eager?: boolean }) {
  useInvitationFonts();
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0);
  // Mount the heavy live render only once the card is near the viewport (mounts at once without IntersectionObserver).
  const [near, setNear] = React.useState(typeof IntersectionObserver === 'undefined');
  React.useEffect(() => {
    if (near) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: '200px' });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [near]);
  React.useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / RENDER_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scheme = design.colorSchemes[0];
  return (
    <>
      <span className="sr-only">{design.name} invitation design</span>
      <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true" inert data-nosnippet>
        {(near || eager) && scale > 0 && scheme && (
          <div style={{ width: RENDER_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <React.Suspense fallback={null}>
              <InvitationView layoutKey={design.layoutKey} scheme={scheme} details={sampleOf(design)} photos={design.samplePhotos ?? []} style={sampleStyle(design.samplePhotos?.length ?? 0)} />
            </React.Suspense>
          </div>
        )}
      </div>
    </>
  );
}

export default function DesignCard({ design, heading: Heading = 'h3' }: { design: Design; heading?: 'h2' | 'h3' }) {
  const href = `/designs/${encodeURIComponent(design.slug)}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-gold-light bg-white shadow-card transition duration-300 hover:shadow-lg motion-safe:hover:-translate-y-1 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-brand-700">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        {design.previewImages[0]
          ? <img src={design.previewImages[0]} alt={`${design.name} invitation design`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
          : <LivePreview design={design} />}
        {isPremium(design) && <PremiumBadge className="absolute left-3 top-3" />}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-gold-light p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{occasionLabel(design.productType)}</p>
        <Heading className="font-serif text-2xl font-semibold leading-tight text-ink">
          {/* The ::after covers the whole card, so a click anywhere opens the design. */}
          <NavLink href={href} className="after:absolute after:inset-0 focus-visible:outline-none">{design.name}</NavLink>
        </Heading>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-semibold text-ink">{hasFrom(design) && 'From '}{peso(design.fromPriceCentavos)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700" aria-hidden="true">
            View design <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
