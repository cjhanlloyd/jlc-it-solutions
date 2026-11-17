// Standard / Premium comparison data. No React imports: the node tests load this file.
import { tierOf, photoLimit, type Tier } from '../../shared/tiers.ts';
import type { Design } from './designs-api.ts';

export type TierPrice = { productType: string; standard: number | null; premium: number | null };
const ORDER = ['wedding', 'debut', 'birthday'];
const rank = (t: string) => { const i = ORDER.findIndex((o) => t.startsWith(o)); return i < 0 ? ORDER.length : i; };

// Lowest template price per tier for each occasion; custom packages are ignored.
export function tierPrices(designs: Pick<Design, 'productType' | 'packages'>[]): TierPrice[] {
  const by = new Map<string, TierPrice>();
  for (const d of designs) {
    for (const p of d.packages) {
      if (p.kind !== 'template') continue;
      const row = by.get(d.productType) ?? { productType: d.productType, standard: null, premium: null };
      const t = tierOf(p);
      row[t] = row[t] === null ? p.priceCentavos : Math.min(row[t], p.priceCentavos);
      by.set(d.productType, row);
    }
  }
  return [...by.values()].sort((a, b) => rank(a.productType) - rank(b.productType) || a.productType.localeCompare(b.productType));
}

// shortcut: retention copy is fixed text (60 days / 6 months); the test checks it against retentionDays.
const online = (t: Tier) => (t === 'premium' ? '6 months' : '60 days');
const upTo = (t: Tier) => `Up to ${photoLimit(t)}`;
export const TIER_FEATURES: { label: string; standard: string | boolean; premium: string | boolean }[] = [
  { label: 'RSVP with guest count', standard: true, premium: true },
  { label: 'Map and directions', standard: true, premium: true },
  { label: 'Countdown', standard: true, premium: true },
  { label: 'Design studio: fonts, colours, cover photo', standard: true, premium: true },
  { label: 'Photo gallery', standard: upTo('standard'), premium: upTo('premium') },
  { label: 'Opening animation', standard: false, premium: true },
  { label: 'Background music from our library', standard: false, premium: true },
  { label: 'Exclusive Premium layouts', standard: false, premium: true },
  { label: 'Online after the event', standard: online('standard'), premium: online('premium') },
];
