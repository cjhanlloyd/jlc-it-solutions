// Designs list (#/designs): occasion filter with counts, featured/published toggles, up/down reorder, links to the editor.
import { useEffect, useState } from 'react';
import { OCCASIONS, occasionOf } from '../../shared/occasions';
import { peso } from '../invitations/kit';
import { Button, EmptyState, Select, Spinner } from '../ui';
import type { Session } from './api';

type Row = {
  id: number; slug: string; name: string; productType: string; layoutKey: string; active: boolean; featured: boolean;
  fromPriceCentavos: number; previewImages: string[]; orderCount: number;
};

let rememberedFilter = '';

export default function DesignsPage({ session }: { session: Session }) {
  const [designs, setDesigns] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState(rememberedFilter);
  const [error, setError] = useState('');

  useEffect(() => {
    session.api<{ designs: Row[] }>('/api/admin/designs').then((d) => setDesigns(d.designs)).catch((e: Error) => setError(e.message));
  }, [session]);
  useEffect(() => { rememberedFilter = filter; }, [filter]);

  // Optimistic: show the change now, put the old list back if the server refuses
  async function apply(next: Row[], body: unknown) {
    const before = designs;
    setDesigns(next);
    setError('');
    try {
      await session.api('/api/admin/designs', body);
    } catch (e) {
      setDesigns(before);
      setError((e as Error).message);
    }
  }
  const toggle = (d: Row, field: 'active' | 'featured') =>
    apply(designs!.map((x) => (x.id === d.id ? { ...x, [field]: !d[field] } : x)), { action: 'toggle', id: d.id, field, value: !d[field] });
  // Moves past the neighbour visible under the current filter; the server gets the full order
  function reorder(shown: Row[], i: number, dir: -1 | 1) {
    const all = designs!.slice();
    const a = all.indexOf(shown[i]);
    const b = all.indexOf(shown[i + dir]);
    [all[a], all[b]] = [all[b], all[a]];
    apply(all, { action: 'reorder', ids: all.map((x) => x.id) });
  }

  const shown = (designs ?? []).filter((d) => !filter || d.productType === filter);
  const count = (t: string) => (designs ?? []).filter((d) => d.productType === t).length;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Designs</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Select label="Occasion" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All occasions ({designs?.length ?? 0})</option>
              {Object.values(OCCASIONS).map((o) => <option key={o.productType} value={o.productType}>{o.label} ({count(o.productType)})</option>)}
            </Select>
          </div>
          <a href="#/designs/new" className="inline-flex items-center rounded-control bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">New design</a>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!designs && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading designs…</p>}
      {designs && (shown.length === 0 ? (
        <div className="mt-6"><EmptyState title="No designs here">Pick another occasion or add a new design.</EmptyState></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">Design</th><th className="px-4 py-3">Occasion</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Featured</th><th className="px-4 py-3">Published</th><th className="px-4 py-3">Order</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((d, i) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <a href={`#/designs/${d.id}`} className="flex items-center gap-3 font-semibold text-brand-800 hover:underline">
                      {d.previewImages[0]
                        ? <img src={d.previewImages[0]} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />
                        : <span aria-hidden="true" className="flex h-14 w-11 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-600">{d.layoutKey.slice(0, 3)}</span>}
                      {d.name}
                    </a>
                    <div className="mt-0.5 font-mono text-xs text-slate-600">{d.slug}</div>
                  </td>
                  <td className="px-4 py-3">{occasionOf(d.productType)?.label ?? d.productType}</td>
                  <td className="px-4 py-3 whitespace-nowrap">From {peso(d.fromPriceCentavos)}</td>
                  <td className="px-4 py-3">{d.orderCount}</td>
                  <td className="px-4 py-3"><input type="checkbox" checked={d.featured} onChange={() => toggle(d, 'featured')} aria-label={`Feature ${d.name}`} className="h-4 w-4" /></td>
                  <td className="px-4 py-3"><input type="checkbox" checked={d.active} onChange={() => toggle(d, 'active')} aria-label={`Publish ${d.name}`} className="h-4 w-4" /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => reorder(shown, i, -1)} aria-label={`Move ${d.name} up`}>Up</Button>{' '}
                    <Button size="sm" variant="secondary" disabled={i === shown.length - 1} onClick={() => reorder(shown, i, 1)} aria-label={`Move ${d.name} down`}>Down</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
