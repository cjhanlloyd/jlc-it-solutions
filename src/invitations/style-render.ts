// Pure rules for rendering an invitation style: font link, cover overlay and text colours, cover photo lookup.
import { FONT_PAIRS, contrast, deriveScheme, type Cover, type InvitationStyle, type Scheme } from '../../shared/invitation-style.ts';

type Style = InvitationStyle | null | undefined;

export const fontPair = (style: Style) =>
  style?.font && Object.prototype.hasOwnProperty.call(FONT_PAIRS, style.font) ? FONT_PAIRS[style.font] : undefined;

export function fontHref(style: Style): string | null {
  const p = fontPair(style);
  return p ? `https://fonts.googleapis.com/css2?family=${p.googleFamilies.join('&family=')}&display=swap` : null;
}

// The 'Custom' scheme takes its colours from style.colors; any other scheme is used as is.
export const effectiveScheme = <S extends Scheme & { name?: string }>(scheme: S, style: Style): S | Scheme =>
  scheme.name === 'Custom' && style?.colors ? deriveScheme(style.colors.primary, style.colors.accent) : scheme;

// The overlay never goes below 30%, so hero text stays readable over any photo.
export const MIN_OVERLAY = 0.3;
const strength = (s: number) => Math.max(s, MIN_OVERLAY);

const DARK_HALO = '0 1px 2px rgba(0,0,0,.55), 0 0 12px rgba(0,0,0,.35)';
const LIGHT_HALO = '0 1px 2px rgba(255,255,255,.6), 0 0 12px rgba(255,255,255,.4)';
// Light text over dark, dark text over light; over the scheme tone, white only when it reads on the primary.
export function coverText(tone: Cover['tone'], primary: string) {
  const light = tone === 'dark' || (tone === 'scheme' && contrast('#ffffff', primary) >= 4.5);
  return light ? { color: '#ffffff', textShadow: DARK_HALO } : { color: '#111111', textShadow: LIGHT_HALO };
}

export const coverOverlay = (tone: Cover['tone'], s: number) =>
  tone === 'dark' ? `rgba(0,0,0,${strength(s)})` : tone === 'light' ? `rgba(255,255,255,${strength(s)})`
    : `color-mix(in srgb, var(--p) ${Math.round(strength(s) * 100)}%, transparent)`;

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
export function coverFor(style: Style, photos: string[]): { cover: CoverShown | null; gallery: string[] } {
  const c = style?.cover;
  const i = typeof c?.photo === 'number' ? c.photo : -1;
  if (!c || !photos[i]) return { cover: null, gallery: photos };
  const { photo: _p, ...rest } = c;
  return { cover: { ...rest, url: photos[i] }, gallery: photos.filter((_, j) => j !== i) };
}
