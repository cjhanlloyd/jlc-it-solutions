// The studio draft kept in sessionStorage: details, style, chosen scheme, attire and contact info. Photos are too large to keep.
import { validateStyle, type InvitationStyle } from '../../../shared/invitation-style.ts';
import { savedFor } from '../forms/restore.ts';
import { validateExtras, type Extras, type GalleryLayout } from '../../../shared/extras.ts';

export type Saved = { slug: string; draft: any; scheme: string; style: InvitationStyle; email: string; name?: string; phone?: string; hadPhotos: boolean; attire?: Extras['attire']; gallery?: GalleryLayout };

// hadPhotos stays set after a restore until photos are added again, so the re-add notice survives further refreshes.
export const serializeDraft = ({ photos, hadPhotos, ...rest }: Omit<Saved, 'hadPhotos'> & { photos: string[]; hadPhotos?: boolean }): string =>
  JSON.stringify({ ...rest, hadPhotos: photos.length > 0 || !!hadPhotos } satisfies Saved);

// Photos are never restored, so neither is the cover; a style that no longer validates restores as layout defaults, and invalid attire as none.
export function parseDraft(raw: string | null, slug: string): Saved | null {
  let saved: Saved | null;
  try { saved = savedFor(JSON.parse(raw || 'null'), slug); } catch { return null; }
  if (!saved) return null;
  const { cover: _c, ...style } = saved.style && typeof saved.style === 'object' ? saved.style : ({} as InvitationStyle);
  const v = validateStyle(style);
  const { attire, gallery, ...rest } = saved;
  const a = attire === undefined ? null : validateExtras({ attire }, 'standard');
  const g = gallery === undefined ? null : validateExtras({ gallery: { layout: gallery } }, 'standard');
  return { ...rest, style: 'error' in v ? {} : v.style, ...(a && 'extras' in a ? { attire: a.extras.attire } : {}), ...(g && 'extras' in g ? { gallery: g.extras.gallery?.layout } : {}) };
}

// One entry per design visited in this studio: the state is kept per occasion, so Back to an earlier design's URL
// restores the latest work rather than what was there before the switch.
export const draftEntries = (prefix: string, slugs: string[], state: Omit<Saved, 'slug' | 'hadPhotos'> & { photos: string[]; hadPhotos?: boolean }): [string, string][] =>
  slugs.map((slug) => [prefix + slug, serializeDraft({ ...state, slug })]);
