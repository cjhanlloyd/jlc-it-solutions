// /: the invitation storefront. Hero, occasions, featured designs, how it works, what's included, FAQ, IT services band.
import React from 'react';
import { ArrowRight, CalendarCheck, Heart, Images, KeyRound, MapPin, Plus, Timer, Users } from 'lucide-react';
import DesignCard from './DesignCard';
import { NavLink } from './NavLink';
import { fetchDesigns, type Design } from './designs-api';
import { fetchSite, type SiteContent } from './site-api';
import { splitAnswer } from './faq-text';
import { FAQS, HERO, HOW_STEPS, INCLUDES, featuredDesigns } from './home-content';
import { occasionLabel } from '../invitations/occasions';

const INCLUDE_ICONS = [Users, MapPin, Timer, Images, KeyRound, CalendarCheck]; // same order as INCLUDES
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-800 ${focusRing}`;
const secondaryBtn = `inline-flex items-center justify-center gap-2 rounded-full border border-gold px-7 py-3.5 text-sm font-semibold text-ink hover:bg-sand ${focusRing}`;
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.22em] text-brand-700';
const h2 = 'font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl';

const linkCls = `font-medium text-brand-700 underline underline-offset-4 ${focusRing}`;

function SectionHead({ id, kicker, title }: { id: string; kicker: string; title: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className={eyebrow}>{kicker}</p>
      <h2 id={id} className={`mt-3 ${h2}`}>{title}</h2>
      <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
    </div>
  );
}

export default function HomePage() {
  const [designs, setDesigns] = React.useState<Design[] | null | 'offline'>(null);
  React.useEffect(() => { fetchDesigns().then(setDesigns, () => setDesigns('offline')); }, []);

  // Arriving on /#how: the designs above change the page height, so scroll again once they have rendered.
  React.useEffect(() => {
    if (designs !== null && window.location.hash === '#how') document.getElementById('how')?.scrollIntoView();
  }, [designs]);

  // Managed copy; the built-in defaults show while loading, when a field is empty, or if the request fails.
  const [site, setSite] = React.useState<SiteContent | null>(null);
  React.useEffect(() => { fetchSite().then(setSite, () => {}); }, []);
  const hero = { eyebrow: site?.home?.eyebrow?.trim() || HERO.eyebrow, title: site?.home?.headline?.trim() || HERO.title, lead: site?.home?.subheadline?.trim() || HERO.lead };
  const faqs: { q: string; a: string; link?: { href: string; label: string } }[] = site?.faqs.length ? site.faqs : FAQS;
  const testimonials = site?.testimonials ?? [];

  const list = Array.isArray(designs) ? designs : [];
  const occasions = [...new Set(list.map((d) => d.productType))].map((t) => ({ type: t, count: list.filter((d) => d.productType === t).length }));
  const featured = featuredDesigns(list);

  return (
    <div className="bg-ivory font-sans text-ink select-text">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gold-light" aria-labelledby="home-title">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:py-28">
          <div className="text-center lg:text-left">
            <p className={eyebrow}>{hero.eyebrow}</p>
            <h1 id="home-title" className="mt-5 font-serif text-5xl font-semibold leading-[1.05] text-ink sm:text-6xl lg:text-7xl">{hero.title}</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/80 lg:mx-0">{hero.lead}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <NavLink href="/designs" className={primaryBtn}>Browse designs <ArrowRight className="h-4 w-4" aria-hidden="true" /></NavLink>
              <NavLink href="/#how" className={secondaryBtn}>How it works</NavLink>
            </div>
          </div>

          {/* Decorative invitation card */}
          <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
            <div className="absolute -inset-4 rotate-3 rounded-card bg-sand" />
            <div className="absolute -inset-4 -rotate-2 rounded-card border border-gold-light bg-brand-50" />
            <div className="relative rounded-card bg-white p-3 shadow-card">
              <div className="border border-gold p-1.5">
                <div className="flex aspect-[4/5] flex-col items-center justify-center border border-gold-light px-6 text-center">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-brand-700">Together with their families</p>
                  <p className="mt-6 font-serif text-5xl italic text-ink">Ana</p>
                  <p className="my-1 font-serif text-3xl italic text-gold">&amp;</p>
                  <p className="font-serif text-5xl italic text-ink">Miguel</p>
                  <div className="my-6 flex items-center gap-3 text-gold"><span className="h-px w-10 bg-gold" /><Heart className="h-3.5 w-3.5" /><span className="h-px w-10 bg-gold" /></div>
                  <p className="font-serif text-2xl text-ink">the fourteenth of March</p>
                  <p className="mt-6 rounded-full bg-brand-700 px-5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white">RSVP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Occasions */}
      {occasions.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-24 lg:px-8" aria-labelledby="occasions-title">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className={eyebrow}>Browse by occasion</p>
            <h2 id="occasions-title" className={`mt-3 ${h2}`}>For every celebration</h2>
          </div>
          <ul className="flex flex-wrap justify-center gap-4">
            {occasions.map((o) => (
              <li key={o.type} className="w-full sm:w-64">
                <NavLink href={`/designs?occasion=${encodeURIComponent(o.type)}`}
                  className={`group flex items-center justify-between rounded-card border border-gold-light bg-white px-6 py-5 shadow-card transition hover:border-gold motion-safe:hover:-translate-y-0.5 ${focusRing}`}>
                  <span>
                    <span className="block font-serif text-3xl font-semibold text-ink">{occasionLabel(o.type)}</span>
                    <span className="mt-1 block text-sm text-ink/80">{o.count} {o.count === 1 ? 'design' : 'designs'}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-brand-700 transition-transform motion-safe:group-hover:translate-x-1" aria-hidden="true" />
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Featured designs */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="featured-title">
        <SectionHead id="featured-title" kicker="The collection" title="Featured designs" />
        {designs === null && <p className="text-center text-sm text-ink/80" role="status">Loading designs…</p>}
        {designs === 'offline' && <p className="text-center text-sm text-ink/80">We could not load the designs. Please check your connection and reload.</p>}
        {Array.isArray(designs) && designs.length === 0 && <p className="text-center text-sm text-ink/80">New designs are coming soon. Please check back later.</p>}
        {featured.length > 0 && (
          <>
            <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => <li key={d.slug}><DesignCard design={d} /></li>)}
            </ul>
            <div className="mt-12 text-center">
              <NavLink href="/designs" className={secondaryBtn}>See all designs <ArrowRight className="h-4 w-4" aria-hidden="true" /></NavLink>
            </div>
          </>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-gold-light bg-sand py-20 sm:py-24" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead id="how-title" kicker="Simple from start to share" title="How it works" />
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((s, i) => (
              <li key={s.title} className="rounded-card border border-gold-light bg-ivory p-7">
                <span className="font-serif text-5xl font-semibold leading-none text-gold" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-5 font-serif text-2xl font-semibold text-ink"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What's included */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="includes-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:items-start">
          <div className="text-center lg:text-left">
            <p className={eyebrow}>No add-ons, no surprises</p>
            <h2 id="includes-title" className={`mt-3 ${h2}`}>Every invitation includes</h2>
            <div className="mx-auto mt-5 h-px w-16 bg-gold lg:mx-0" aria-hidden="true" />
            <p className="mt-5 text-base leading-relaxed text-ink/80">One price per design, shown up front. Everything your guests need is on one page.</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
            {INCLUDES.map((it, i) => {
              const Icon = INCLUDE_ICONS[i];
              return (
                <li key={it.label} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-light bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span>
                    <span className="block font-semibold text-ink">{it.label}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink/80">{it.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8" aria-labelledby="kind-words-title">
          <h2 id="kind-words-title" className={`mb-10 text-center ${h2}`}>Kind words</h2>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <li key={i} className="flex flex-col rounded-card border border-gold-light bg-white p-7 shadow-card">
                <blockquote className="flex-1 font-serif text-xl italic leading-relaxed text-ink">“{t.quote}”</blockquote>
                <div className="mt-6 flex items-center gap-3">
                  {t.photoUrl && <img src={t.photoUrl} alt={t.name} loading="lazy" className="h-12 w-12 rounded-full object-cover" />}
                  <p className="text-sm"><span className="block font-semibold text-ink">{t.name}</span><span className="text-ink/80">{t.occasion}</span></p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ */}
      <section className="border-t border-gold-light bg-sand py-20 sm:py-24" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHead id="faq-title" kicker="Good to know" title="Questions, answered" />
          <div className="divide-y divide-gold-light border-y border-gold-light">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-serif text-2xl font-semibold text-ink [&::-webkit-details-marker]:hidden ${focusRing}`}>
                  {f.q}
                  <Plus className="h-5 w-5 shrink-0 text-brand-700 transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <div className="pb-6 text-base leading-relaxed text-ink/80">
                  <p>{splitAnswer(f.a).map((p, i) => !p.href ? <React.Fragment key={i}>{p.text}</React.Fragment>
                    : p.href.startsWith('/') ? <NavLink key={i} href={p.href} className={linkCls}>{p.text}</NavLink>
                    : <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className={linkCls}>{p.text}</a>)}</p>
                  {f.link && <NavLink href={f.link.href} className={`mt-2 inline-block font-medium text-brand-700 underline underline-offset-4 ${focusRing}`}>{f.link.label}</NavLink>}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* IT services band */}
      <section className="bg-brand-700 text-white" aria-label="Also from JLC: IT services">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p className="text-base"><span className="font-serif text-2xl font-semibold">Also from JLC: IT services.</span> <span className="text-white/90">Consulting, custom software and office networks.</span></p>
          <NavLink href="/services" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/70 px-6 py-2.5 text-sm font-semibold hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Other services <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </NavLink>
        </div>
      </section>
    </div>
  );
}
