// "Compare packages": Standard vs Premium prices per occasion and a feature checklist. Table from sm up, two cards on phones.
import { Check, Minus } from 'lucide-react';
import { peso } from '../invitations/kit';
import { occasionLabel } from '../invitations/occasions';
import type { Design } from './designs-api';
import { NavLink } from './NavLink';
import { TIER_FEATURES, tierPrices } from './tier-prices';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const btn = `inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 ${focusRing}`;
const TIERS = [{ key: 'standard', name: 'Standard', label: 'Browse Standard designs' }, { key: 'premium', name: 'Premium', label: 'Browse Premium designs' }] as const;
const premiumBg = 'bg-gold-light/30';

const price = (c: number | null) => (c === null ? '—' : `From ${peso(c)}`);
function Mark({ v }: { v: string | boolean }) {
  if (typeof v === 'string') return <>{v}</>;
  return v
    ? <><Check className="mx-auto h-5 w-5 text-brand-700" aria-hidden="true" /><span className="sr-only">Included</span></>
    : <><Minus className="mx-auto h-5 w-5 text-ink/80" aria-hidden="true" /><span className="sr-only">Not included</span></>;
}

export default function PricingCompare({ designs }: { designs: Design[] }) {
  const prices = tierPrices(designs);
  if (prices.length === 0) return null;
  return (
    <section aria-labelledby="compare-title" className="mt-20 border-t border-gold-light pt-14">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Pricing</p>
        <h2 id="compare-title" className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">Standard or Premium</h2>
        <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
      </div>

      <div className="mx-auto hidden max-w-4xl sm:block">
        <table className="w-full border-collapse overflow-hidden rounded-card border border-gold-light bg-white text-left shadow-card">
          <caption className="sr-only">Standard and Premium packages compared</caption>
          <thead>
            <tr>
              <td className="p-4" />
              {TIERS.map((t) => (
                <th key={t.key} scope="col" className={`p-4 text-center font-serif text-2xl font-semibold ${t.key === 'premium' ? premiumBg : ''}`}>{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map((r) => (
              <tr key={r.productType} className="border-t border-gold-light">
                <th scope="row" className="p-4 text-sm font-semibold">{occasionLabel(r.productType)}</th>
                <td className="p-4 text-center text-sm">{price(r.standard)}</td>
                <td className={`p-4 text-center text-sm font-semibold ${premiumBg}`}>{price(r.premium)}</td>
              </tr>
            ))}
            {TIER_FEATURES.map((f) => (
              <tr key={f.label} className="border-t border-gold-light">
                <th scope="row" className="p-4 text-sm font-normal">{f.label}</th>
                <td className="p-4 text-center text-sm"><Mark v={f.standard} /></td>
                <td className={`p-4 text-center text-sm ${premiumBg}`}><Mark v={f.premium} /></td>
              </tr>
            ))}
            <tr className="border-t border-gold-light">
              <td className="p-4" />
              {TIERS.map((t) => (
                <td key={t.key} className={`p-4 text-center ${t.key === 'premium' ? premiumBg : ''}`}>
                  <NavLink href="/designs" className={btn}>{t.label}</NavLink>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-6 sm:hidden">
        {TIERS.map((t) => (
          <div key={t.key} className={`rounded-card border border-gold-light p-5 shadow-card ${t.key === 'premium' ? premiumBg : 'bg-white'}`}>
            <h3 className="font-serif text-2xl font-semibold">{t.name}</h3>
            <dl className="mt-4 space-y-1 text-sm">
              {prices.map((r) => (
                <div key={r.productType} className="flex justify-between gap-3">
                  <dt className="font-semibold">{occasionLabel(r.productType)}</dt>
                  <dd>{price(r[t.key])}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-2 border-t border-gold-light pt-4 text-sm">
              {TIER_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start justify-between gap-3">
                  <span>{f.label}</span>
                  <span className="shrink-0 text-right"><Mark v={f[t.key]} /></span>
                </li>
              ))}
            </ul>
            <NavLink href="/designs" className={`${btn} mt-6 w-full`}>{t.label}</NavLink>
          </div>
        ))}
      </div>
    </section>
  );
}
