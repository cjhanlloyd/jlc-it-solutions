// Pure studio rules: what carries over when switching designs, and the Review & checkout summary rows.
import { FONT_PAIRS, type InvitationStyle } from '../../../shared/invitation-style.ts';
import { resolveOrderPackage, type Package } from '../../../shared/packages.ts';
import { photoLimit, type Tier } from '../../../shared/tiers.ts';
import type { StudioTab } from './StudioTabs.tsx';

type Target = { slug: string; packages: Package[]; colorSchemes: { name: string }[] };

// Same occasion, so details, photos and style carry over as they are; only the package and scheme need resolving.
export function switchTo(to: Target, cur: { packageKey?: string; scheme: string; style: InvitationStyle }) {
  const key = resolveOrderPackage(to.packages, cur.packageKey)?.key;
  const keep = (cur.scheme === 'Custom' && !!cur.style.colors) || to.colorSchemes.some((s) => s.name === cur.scheme);
  return {
    packageKey: key,
    url: `/designs/${encodeURIComponent(to.slug)}/customise${key ? `?package=${encodeURIComponent(key)}` : ''}`,
    scheme: keep ? cur.scheme : to.colorSchemes[0]?.name ?? '',
  };
}

// edit: visible text of the Edit button when it opens something other than the row itself.
export type ReviewRow = { label: string; value: string; tab: StudioTab; edit?: string };
type ReviewInput = {
  design: string; pkg: { name: string; kind: Package['kind'] }; price: string; scheme: string; style: InvitationStyle; photos: number;
  title: string; date: string; venue: string; notes: string;
  tier?: Tier; trackTitle?: string; // trackTitle: the chosen music track's title, when known
};

const longDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function reviewRows(i: ReviewInput): ReviewRow[] {
  const c = i.style.cover;
  const tier = i.tier ?? 'standard';
  const rows: ReviewRow[] = [
    { label: 'Design', value: i.design, tab: 'design' },
    { label: 'Package', value: `${i.pkg.name} · ${i.price}`, tab: 'design', edit: 'Edit design' }, // the studio has no package control
    { label: 'Font', value: i.style.font ? FONT_PAIRS[i.style.font].label : 'Design default', tab: 'design' },
    { label: 'Colours', value: i.scheme === 'Custom' && i.style.colors ? `Custom (${i.style.colors.primary}, ${i.style.colors.accent})` : i.scheme, tab: 'design' },
    {
      label: 'Cover', tab: 'photos',
      value: c && typeof c.photo === 'number'
        ? ['On', `photo ${c.photo + 1}`, `zoom ${Math.round(c.zoom * 100)}%`, `${c.tone} overlay ${Math.round(c.strength * 100)}%`, ...(c.fade ? ['fade'] : [])].join(' · ')
        : 'Off',
    },
    { label: 'Photos', value: `${i.photos} of ${photoLimit(tier)}`, tab: 'photos' },
    ...(tier === 'premium' ? [
      { label: 'Opening animation', value: i.style.intro === false ? 'Off' : 'On', tab: 'design' as const },
      { label: 'Music', value: i.style.music === undefined ? 'None' : i.trackTitle ?? 'Selected track', tab: 'design' as const },
    ] : []),
    { label: 'Details', value: [i.title, i.date && longDate(i.date), i.venue].filter(Boolean).join(' · '), tab: 'details' },
  ];
  if (i.pkg.kind === 'custom') rows.push({ label: 'Designer notes', value: i.notes, tab: 'details' });
  return rows;
}
