// Manage page "Event features": a tablist; each tab lives in its own component. Premium-only tabs are hidden on Standard.
import React from 'react';
import type { Extras } from '../../../shared/extras';
import { occasionOf } from '../../../shared/occasions';
import type { InvitationStyle } from '../../../shared/invitation-style';
import type { Scheme } from '../parts';
import { effectiveScheme } from '../style-render';
import AttireTab, { type AttirePhoto } from './AttireTab';
import BoothTab from './BoothTab';
import CheckinTab from './CheckinTab';
import GalleryTab from './GalleryTab';
import GiftsTab, { type GiftItem } from './GiftsTab';
import GuestPhotosTab from './GuestPhotosTab';
import type { Api } from './shared';

const ALL_TABS = [{ id: 'attire', label: 'Attire & motif' }, { id: 'gifts', label: 'Gifts' }, { id: 'gallery', label: 'Gallery' }, { id: 'guest-photos', label: 'Guest photos', premium: true }, { id: 'booth', label: 'Photo booth', premium: true }, { id: 'checkin', label: 'Check-in', premium: true }] as const;

export default function EventFeatures({ api, initial }: { api: Api; initial: { tier?: 'standard' | 'premium'; colorScheme?: Scheme; style?: InvitationStyle; details?: any; productType?: string; extras?: Extras; attirePhotos?: AttirePhoto[]; giftItems?: GiftItem[] } }) {
  const [tab, setTab] = React.useState<(typeof ALL_TABS)[number]['id']>('attire');
  const TABS = ALL_TABS.filter((t) => !('premium' in t) || initial.tier === 'premium');
  const [extras, setExtras] = React.useState<Extras>(initial.extras ?? {});
  const [photos, setPhotos] = React.useState<AttirePhoto[]>(initial.attirePhotos ?? []);
  const [items, setItems] = React.useState<GiftItem[]>(initial.giftItems ?? []);
  // Booth thumbnails in this invitation's colours, names and date
  const boothOpts = React.useMemo(() => {
    const s = effectiveScheme(initial.colorScheme ?? { primary: '#7a5752', accent: '#b8955a', background: '#faf7f2', text: '#3a3330' }, initial.style ?? {});
    const c = occasionOf(initial.productType)?.card(initial.details ?? {});
    return { primary: s.primary, accent: s.accent, background: s.background, text: s.text, headline: c?.headline ?? '', kicker: c?.kicker ?? '', date: c?.dateLine ?? '' };
  }, [initial.colorScheme, initial.style, initial.productType, initial.details]);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + d + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(`ef-tab-${next}`)?.focus();
  };
  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-4" aria-labelledby="ef-h">
      <h2 id="ef-h" className="text-lg font-extrabold text-slate-900 font-display">Event features</h2>
      <div role="tablist" aria-label="Event features" onKeyDown={onKey} className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} id={`ef-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`ef-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>{t.label}</button>
        ))}
      </div>
      <div id="ef-panel-attire" role="tabpanel" aria-labelledby="ef-tab-attire" hidden={tab !== 'attire'}><AttireTab api={api} extras={extras} onExtras={setExtras} photos={photos} onPhotos={setPhotos} /></div>
      <div id="ef-panel-gifts" role="tabpanel" aria-labelledby="ef-tab-gifts" hidden={tab !== 'gifts'}><GiftsTab api={api} extras={extras} onExtras={setExtras} items={items} onItems={setItems} /></div>
      <div id="ef-panel-gallery" role="tabpanel" aria-labelledby="ef-tab-gallery" hidden={tab !== 'gallery'}><GalleryTab api={api} extras={extras} onExtras={setExtras} /></div>
      {initial.tier === 'premium' && <div id="ef-panel-guest-photos" role="tabpanel" aria-labelledby="ef-tab-guest-photos" hidden={tab !== 'guest-photos'}><GuestPhotosTab api={api} extras={extras} onExtras={setExtras} /></div>}
      {initial.tier === 'premium' && <div id="ef-panel-booth" role="tabpanel" aria-labelledby="ef-tab-booth" hidden={tab !== 'booth'}><BoothTab api={api} extras={extras} onExtras={setExtras} opts={boothOpts} /></div>}
      {initial.tier === 'premium' && <div id="ef-panel-checkin" role="tabpanel" aria-labelledby="ef-tab-checkin" hidden={tab !== 'checkin'}><CheckinTab api={api} extras={extras} onExtras={setExtras} active={tab === 'checkin'} /></div>}
    </section>
  );
}
