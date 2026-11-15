// The studio draft kept in sessionStorage: details, style, chosen scheme and contact info. Photos are too large to keep.
import { validateStyle, type InvitationStyle } from '../../../shared/invitation-style.ts';
import { savedFor } from '../forms/restore.ts';

export type Saved = { slug: string; draft: any; scheme: string; style: InvitationStyle; email: string; name?: string; phone?: string; hadPhotos: boolean };

export const serializeDraft = ({ photos, ...rest }: Omit<Saved, 'hadPhotos'> & { photos: string[] }): string =>
  JSON.stringify({ ...rest, hadPhotos: photos.length > 0 } satisfies Saved);

// Photos are never restored, so neither is the cover; a style that no longer validates restores as layout defaults.
export function parseDraft(raw: string | null, slug: string): Saved | null {
  let saved: Saved | null;
  try { saved = savedFor(JSON.parse(raw || 'null'), slug); } catch { return null; }
  if (!saved) return null;
  const { cover: _c, ...style } = saved.style && typeof saved.style === 'object' ? saved.style : ({} as InvitationStyle);
  const v = validateStyle(style);
  return { ...saved, style: 'error' in v ? {} : v.style };
}
