// /designs/<slug>: the design details page. Large live preview (colour schemes, phone frame), what's included, price and Order now.
import React from 'react';
import { ArrowLeft, ArrowRight, Check, Smartphone } from 'lucide-react';
import InvitationView from '../invitations/InvitationView';
import { peso, useInvitationFonts } from '../invitations/kit';
import { formOf } from '../invitations/forms';
import { occasionLabel } from '../invitations/occasions';
import { pickPackage, type Package } from '../../shared/packages';
import { fetchDesigns, type Design } from './designs-api';
import { INCLUDES } from './home-content';
import { sampleOf } from './DesignCard';
import { NavLink } from './NavLink';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-8 py-4 text-base font-semibold text-white shadow-card hover:bg-brand-800 ${focusRing}`;
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.22em] text-brand-700';
const PHONE = { w: 390, h: 780, bezel: 12 };

function BackLink() {
  return (
    <NavLink href="/designs" className={`inline-flex items-center gap-1 rounded text-sm font-medium text-brand-700 hover:underline ${focusRing}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to designs
    </NavLink>
  );
}

// The 390×780 phone, scaled down (never up) to the width it is given.
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const outerW = PHONE.w + PHONE.bezel * 2, outerH = PHONE.h + PHONE.bezel * 2;
  React.useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / outerW)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [outerW]);
  return (
    <div ref={ref} className="flex w-full justify-center py-6">
      <div style={{ width: outerW * scale, height: outerH * scale }}>
        <div style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: 'top left', borderWidth: PHONE.bezel }}
          className="overflow-hidden rounded-[3rem] border-ink bg-ink shadow-2xl">
          <div style={{ width: PHONE.w, height: PHONE.h }} className="overflow-y-auto overflow-x-hidden rounded-[2.25rem] bg-white">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PackageBody({ p }: { p: Package }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-serif text-xl font-semibold">{p.name}</span>
        <span className="font-semibold">{peso(p.priceCentavos)}</span>
      </span>
      {p.kind === 'custom' && <span className="mt-1 inline-block rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink">Made to order</span>}
      {p.inclusions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {p.inclusions.map((i) => (
            <li key={i} className="flex gap-2 text-sm text-ink/80">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" /> {i}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8" role="status" aria-label="Loading design">
      <span className="sr-only">Loading design…</span>
      <div className="space-y-4 motion-safe:animate-pulse">
        <div className="h-4 w-24 rounded bg-sand" />
        <div className="h-12 w-3/4 rounded bg-sand" />
        <div className="h-4 w-full rounded bg-sand" />
        <div className="h-4 w-5/6 rounded bg-sand" />
        <div className="h-14 w-48 rounded-full bg-sand" />
      </div>
      <div className="h-[60vh] rounded-card bg-sand motion-safe:animate-pulse" />
    </div>
  );
}

export default function DesignPage({ slug }: { slug: string }) {
  useInvitationFonts();
  const [design, setDesign] = React.useState<Design | null | 'missing' | 'offline'>(null);
  const [schemeName, setSchemeName] = React.useState('');
  const [phone, setPhone] = React.useState(false);
  const [pkgKey, setPkgKey] = React.useState('');

  const load = React.useCallback((alive: () => boolean = () => true) => {
    setDesign(null);
    fetchDesigns().then((all) => {
      if (!alive()) return;
      const d = all.find((x) => x.slug === slug);
      setDesign(d ?? 'missing');
      if (!d) { document.title = 'Design not found | JLC Solutions'; return; }
      setSchemeName(d.colorSchemes[0]?.name ?? '');
      setPkgKey(pickPackage(d.packages)?.key ?? '');
      document.title = `${d.name} | JLC Solutions`;
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        d.description.trim() || `${occasionLabel(d.productType)} invitation design — personalise it, pay with GCash, share one link.`);
    }, () => { if (alive()) setDesign('offline'); });
  }, [slug]);
  React.useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => { alive = false; };
  }, [load]);

  if (design === null) return <div className="bg-ivory"><Skeleton /></div>;
  if (design === 'missing' || design === 'offline') {
    return (
      <div className="bg-ivory px-4 py-24 text-center font-sans text-ink">
        <div className="mx-auto max-w-md rounded-card border border-gold-light bg-white p-10 shadow-card">
          <h1 className="font-serif text-4xl font-semibold leading-tight">
            {design === 'missing' ? "We couldn't find that design" : "We couldn't load this design"}
          </h1>
          <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-sm text-ink/80">
            {design === 'missing' ? 'It may have been retired. Have a look at the rest of the collection.' : 'Please check your connection and try again.'}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            {design === 'offline' && <button type="button" onClick={() => load()} className={primaryBtn}>Try again</button>}
            {design === 'missing'
              ? <NavLink href="/designs" className={primaryBtn}>Browse designs</NavLink>
              : <BackLink />}
          </div>
        </div>
      </div>
    );
  }

  const scheme = design.colorSchemes.find((s) => s.name === schemeName) ?? design.colorSchemes[0];
  const pkg = pickPackage(design.packages, pkgKey);
  const custom = pkg?.kind === 'custom';
  const orderable = formOf(design.productType) !== null;
  const preview = scheme && <InvitationView layoutKey={design.layoutKey} scheme={scheme} details={sampleOf(design)} photos={[]} />;

  return (
    <div className="bg-ivory font-sans text-ink select-text">
      {/* DOM order head → preview → includes is the mobile reading order; on lg the preview spans both rows of column 2. */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:px-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <BackLink />
          <p className={`mt-8 ${eyebrow}`}>{occasionLabel(design.productType)} invitation</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight sm:text-6xl">{design.name}</h1>
          <div className="mt-5 h-px w-16 bg-gold" aria-hidden="true" />
          {design.description.trim() && <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-ink/80">{design.description}</p>}

          <div className="mt-8 flex items-baseline gap-3">
            <span className="font-serif text-4xl font-semibold">{peso(pkg?.priceCentavos ?? design.priceCentavos)}</span>
            <span className="text-sm text-ink/80">{custom ? 'Made to order — our designer creates it after your payment is verified' : "one-time payment by GCash"}</span>
          </div>

          {design.colorSchemes.length > 1 && (
            <fieldset className="mt-8">
              <legend className="text-sm font-semibold">Colour scheme: <span className="font-normal">{scheme?.name}</span></legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {design.colorSchemes.map((s) => (
                  <label key={s.name} className={`flex cursor-pointer items-center gap-2 rounded-full border bg-white py-1.5 pl-1.5 pr-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 ${s.name === scheme?.name ? 'border-brand-700 ring-1 ring-brand-700' : 'border-gold-light hover:border-gold'}`}>
                    <input type="radio" name="scheme" value={s.name} checked={s.name === scheme?.name} onChange={() => setSchemeName(s.name)} className="sr-only" />
                    <span className="h-7 w-7 shrink-0 rounded-full border border-ink/20" aria-hidden="true"
                      style={{ background: `conic-gradient(${s.primary} 0 50%, ${s.accent} 0 75%, ${s.background} 0)` }} />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {pkg && (design.packages.length > 1
            ? (
              <fieldset className="mt-8">
                <legend className="text-sm font-semibold">Choose a package</legend>
                <div className="mt-3 grid gap-3">
                  {design.packages.map((p) => (
                    <label key={p.key} className={`block cursor-pointer rounded-card border bg-white p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 ${p.key === pkg.key ? 'border-brand-700 ring-1 ring-brand-700' : 'border-gold-light hover:border-gold'}`}>
                      <input type="radio" name="package" value={p.key} checked={p.key === pkg.key} onChange={() => setPkgKey(p.key)} className="sr-only" />
                      <PackageBody p={p} />
                    </label>
                  ))}
                </div>
              </fieldset>
            )
            : <div className="mt-8 rounded-card border border-gold-light bg-white p-4"><PackageBody p={pkg} /></div>)}

          <div className="mt-10">
            {orderable && pkg ? (
              <NavLink href={`/designs/${encodeURIComponent(design.slug)}/customise?package=${encodeURIComponent(pkg.key)}`} className={`${primaryBtn} w-full sm:w-auto`}>
                Order now <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </NavLink>
            ) : (
              <>
                <button type="button" disabled className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-sand px-8 py-4 text-base font-semibold text-ink/70 sm:w-auto">Order now</button>
                <p className="mt-3 text-sm text-ink/80">
                  This design can't be ordered online yet — <NavLink href="/contact" className={`font-semibold text-brand-700 underline ${focusRing}`}>contact us</NavLink>
                </p>
              </>
            )}
            {!custom && <p className="mt-3 text-sm text-ink/80">Add your details next and see your invitation update as you type.</p>}
          </div>
        </div>

        <section aria-label={`Preview of ${design.name}`} className="lg:col-start-2 lg:row-span-2 lg:row-start-1" data-nosnippet>
          <div className="lg:sticky lg:top-28">
            <div className="mb-3 flex justify-end">
              <button type="button" aria-pressed={phone} onClick={() => setPhone(!phone)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${focusRing} ${phone ? 'border-brand-700 bg-brand-700 text-white' : 'border-gold bg-white text-ink hover:bg-sand'}`}>
                <Smartphone className="h-4 w-4" aria-hidden="true" /> Phone preview
              </button>
            </div>
            {phone
              ? <div className="rounded-card border border-gold-light bg-sand"><PhoneFrame>{preview}</PhoneFrame></div>
              : <div className="max-h-[70vh] overflow-y-auto rounded-card border border-gold-light bg-white shadow-card lg:h-[calc(100vh-11rem)] lg:max-h-none">{preview}</div>}
          </div>
        </section>

        <section aria-labelledby="includes" className="border-t border-gold-light pt-8 lg:col-start-1 lg:row-start-2">
          <h2 id="includes" className="font-serif text-3xl font-semibold">Every invitation includes</h2>
          <ul className="mt-6 space-y-4">
            {INCLUDES.map((it) => (
              <li key={it.label} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                <span><span className="font-semibold">{it.label}.</span> <span className="text-sm text-ink/80">{it.detail}</span></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
