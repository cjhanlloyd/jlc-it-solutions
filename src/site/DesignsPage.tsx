// /designs: the marketplace. Search, occasion chips and sort, kept in the URL (?q=&occasion=&sort=) with replaceState.
import React from 'react';
import DesignCard from './DesignCard';
import PricingCompare from './PricingCompare';
import { fetchDesigns, type Design } from './designs-api';
import { filterDesigns, parseQuery, toQuery, type FilterState } from './design-filter';
import { occasionLabel } from '../invitations/occasions';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
const DEFAULTS: FilterState = { q: '', occasion: 'all', sort: 'featured' };

export default function DesignsPage() {
  const [designs, setDesigns] = React.useState<Design[] | null | 'offline'>(null);
  const [state, setState] = React.useState<FilterState>(() => parseQuery(window.location.search));
  React.useEffect(() => { fetchDesigns().then(setDesigns, () => setDesigns('offline')); }, []);
  React.useEffect(() => {
    const onPop = () => setState(parseQuery(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = (patch: Partial<FilterState>) => {
    const next = { ...state, ...patch };
    setState(next);
    const qs = toQuery(next);
    window.history.replaceState(window.history.state, '', `/designs${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const list = Array.isArray(designs) ? designs : [];
  const types = [...new Set(list.map((d) => d.productType))];
  const shown = filterDesigns(list, state);
  const chip = (value: string, label: string) => (
    <button key={value} type="button" aria-pressed={state.occasion === value} onClick={() => update({ occasion: value })}
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${focusRing} ${state.occasion === value ? 'border-brand-700 bg-brand-700 text-white' : 'border-gold bg-white text-ink hover:bg-sand'}`}>
      {label}
    </button>
  );

  return (
    <div className="bg-ivory font-sans text-ink select-text">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">The collection</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight text-ink sm:text-6xl">Invitation designs</h1>
          <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
        </header>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block text-sm font-medium text-ink">
              Search designs
              <input type="search" value={state.q} onChange={(e) => update({ q: e.target.value })} placeholder="Name or occasion"
                className={`mt-1 block w-full rounded-control border border-gold bg-white px-3 py-2.5 text-base sm:w-72 ${focusRing}`} />
            </label>
            <label className="block text-sm font-medium text-ink">
              Sort by
              <select value={state.sort} onChange={(e) => update({ sort: e.target.value as FilterState['sort'] })}
                className={`mt-1 block w-full rounded-control border border-gold bg-white px-3 py-2.5 text-base sm:w-48 ${focusRing}`}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
              </select>
            </label>
          </div>
          {types.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Occasion">
              {chip('all', 'All')}
              {types.map((t) => chip(t, occasionLabel(t)))}
            </div>
          )}
        </div>

        <p className="mb-6 text-sm text-ink/80" aria-live="polite">
          {Array.isArray(designs) ? `${shown.length} ${shown.length === 1 ? 'design' : 'designs'}` : ''}
        </p>

        {designs === null && <p className="text-center text-sm text-ink/80" role="status">Loading designs…</p>}
        {designs === 'offline' && <p className="text-center text-sm text-ink/80">We could not load the designs. Please check your connection and reload.</p>}
        {Array.isArray(designs) && designs.length === 0 && <p className="text-center text-sm text-ink/80">New designs are coming soon. Please check back later.</p>}
        {list.length > 0 && shown.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-serif text-3xl font-semibold text-ink">No designs match</p>
            <p className="mt-2 text-sm text-ink/80">Try a different search or occasion.</p>
            <button type="button" onClick={() => update(DEFAULTS)}
              className={`mt-6 rounded-full bg-brand-700 px-7 py-3 text-sm font-semibold text-white hover:bg-brand-800 ${focusRing}`}>
              Clear filters
            </button>
          </div>
        )}
        {shown.length > 0 && (
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => <li key={d.slug}><DesignCard design={d} /></li>)}
          </ul>
        )}
        <PricingCompare designs={list} />
      </div>
    </div>
  );
}
