// Pure rules for rendering an invitation style: font link, cover overlay and text colours, cover photo lookup.
import { FONT_PAIRS, type Cover, type InvitationStyle } from '../../shared/invitation-style.ts';

export const fontPair = (style?: InvitationStyle) =>
  style?.font && Object.prototype.hasOwnProperty.call(FONT_PAIRS, style.font) ? FONT_PAIRS[style.font] : undefined;

export function fontHref(style?: InvitationStyle): string | null {
  const p = fontPair(style);
  return p ? `https://fonts.googleapis.com/css2?family=${p.googleFamilies.join('&family=')}&display=swap` : null;
}

export const coverText = (tone: Cover['tone']) =>
  tone === 'light' ? { color: '#111', textShadow: 'none' } : { color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.45)' };

export const coverOverlay = (tone: Cover['tone'], s: number) =>
  tone === 'dark' ? `rgba(0,0,0,${s})` : tone === 'light' ? `rgba(255,255,255,${s})` : `color-mix(in srgb, var(--p) ${Math.round(s * 100)}%, transparent)`;

// Manage and admin responses store the cover as a photo key; the renderer wants its index in the current photo list.
export function resolveCoverIndex(style: InvitationStyle, keys: string[]): InvitationStyle {
  const c = style.cover;
  if (!c || typeof c.photo !== 'string') return style;
  const i = keys.indexOf(c.photo);
  if (i >= 0) return { ...style, cover: { ...c, photo: i } };
  const { cover: _c, ...rest } = style;
  return rest;
}

export type CoverShown = Omit<Cover, 'photo'> & { url: string };

// The cover photo (by index) and the remaining photos for the gallery.
export function coverFor(style: InvitationStyle | undefined, photos: string[]): { cover: CoverShown | null; gallery: string[] } {
  const c = style?.cover;
  const i = typeof c?.photo === 'number' ? c.photo : -1;
  if (!c || !photos[i]) return { cover: null, gallery: photos };
  const { photo: _p, ...rest } = c;
  return { cover: { ...rest, url: photos[i] }, gallery: photos.filter((_, j) => j !== i) };
}
