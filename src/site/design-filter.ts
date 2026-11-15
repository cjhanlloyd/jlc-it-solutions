// Marketplace search, occasion filter, sort and URL state. No React imports: the node tests load this file.
import type { Design } from './designs-api.ts';
import { occasionLabel } from '../invitations/occasions.ts';

export type Sort = 'featured' | 'price-asc';
export type FilterState = { q: string; occasion: string; sort: Sort };

export function filterDesigns(designs: Design[], { q, occasion, sort }: FilterState): Design[] {
  const needle = q.trim().toLowerCase();
  const out = designs.filter((d) =>
    (occasion === 'all' || d.productType === occasion) &&
    (!needle || d.name.toLowerCase().includes(needle) || occasionLabel(d.productType).toLowerCase().includes(needle)));
  // Array.prototype.sort is stable, so ties keep the API's sort order.
  return sort === 'price-asc'
    ? out.sort((a, b) => a.fromPriceCentavos - b.fromPriceCentavos)
    : out.sort((a, b) => Number(b.featured) - Number(a.featured));
}

export function parseQuery(search: string): FilterState {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  return { q: p.get('q') ?? '', occasion: p.get('occasion') || 'all', sort: sort === 'price-asc' ? 'price-asc' : 'featured' };
}

export function toQuery({ q, occasion, sort }: FilterState): string {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (occasion !== 'all') p.set('occasion', occasion);
  if (sort !== 'featured') p.set('sort', sort);
  return p.toString();
}
