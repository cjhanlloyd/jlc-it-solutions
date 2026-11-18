// What the attire and gifts sections show. Pure, so node tests can check it without rendering.
import type { ReactNode } from 'react';
import type { Extras, GalleryLayout, GiftMethod } from '../../shared/extras.ts';

export type Attire = NonNullable<Extras['attire']>;
export type AttirePhoto = { url: string; caption?: string | null };
export type WishItem = { id: number; name: string; note?: string | null; link?: string | null; priceCentavos?: number | null; reserved: boolean; reservedByYou?: boolean };
// Everything the layouts need for the event sections. Previews pass no handlers, so they show no reserve buttons.
export type EventData = {
  attire?: Attire; attirePhotos?: AttirePhoto[]; giftItems?: WishItem[]; giftMethods?: GiftMethod[];
  onReserve?: (item: WishItem) => void; onRelease?: (item: WishItem) => void;
  busyId?: number | null; wishMessage?: { id: number; text: string; error?: boolean } | null;
  // Gallery: the layout of every photo block, approved guest photos, and the guest page's "Share your photos" form
  galleryLayout?: GalleryLayout; guestPhotos?: string[]; guestShare?: ReactNode;
};

// With neither of these, a layout renders its old "Good to know" block exactly as before.
export const hasAttire = (e?: EventData) => !!(e?.attire?.motif || e?.attire?.palette?.length || e?.attire?.notes || e?.attirePhotos?.length);
export const hasGiftExtras = (e?: EventData) => !!(e?.giftItems?.length || e?.giftMethods?.length);

// What stays in a layout's old notes block: the dress code moves into Attire & motif, the note and QR into Gifts.
export const legacyNotes = (e: EventData | undefined, dressCode?: string, giftsNote?: string, giftQr?: string) => ({
  dress: hasAttire(e) ? '' : dressCode, gifts: hasGiftExtras(e) ? '' : giftsNote || giftQr,
});

export const peso = (centavos: number) =>
  `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export type WishState = 'none' | 'open' | 'reserved' | 'yours';
export const wishState = (item: WishItem, interactive: boolean): WishState =>
  !interactive ? 'none' : item.reservedByYou ? 'yours' : item.reserved ? 'reserved' : 'open';
