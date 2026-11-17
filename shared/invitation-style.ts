// Invitation style: font pair, custom colours and cover photo. Shared by the browser studio and the server checks.
import type { Tier } from './tiers.ts';
export type Scheme = { primary: string; accent: string; background: string; text: string };
export type Cover = { photo: number | string; x: number; y: number; zoom: number; tone: 'dark' | 'light' | 'scheme'; strength: number; fade: boolean };
export type InvitationStyle = { v?: 1; font?: FontKey; colors?: { primary: string; accent: string }; cover?: Cover; intro?: boolean; music?: number };
export type FontKey = 'classic' | 'modern' | 'romantic' | 'playful' | 'elegant';

// Shop previews: a design's first sample photo becomes the cover, under a soft dark overlay so the names stay readable.
export const sampleStyle = (photoCount: number): InvitationStyle =>
  photoCount > 0 ? { v: 1, cover: { photo: 0, x: 50, y: 40, zoom: 1, tone: 'dark', strength: 0.35, fade: false } } : {};

const pair = (label: string, serif: string, sans: string, serifW = ':wght@400;600', sansW = ':wght@400;600') => ({
  label, serif, sans,
  googleFamilies: [serif.replace(/ /g, '+') + serifW, sans.replace(/ /g, '+') + sansW],
});
export const FONT_PAIRS: Record<FontKey, { label: string; serif: string; sans: string; googleFamilies: string[] }> = {
  classic: pair('Classic', 'Cormorant Garamond', 'Jost'),
  modern: pair('Modern', 'DM Serif Display', 'Inter', ''),
  romantic: pair('Romantic', 'Great Vibes', 'Lato', '', ':wght@400;700'), // Lato has no 600
  playful: pair('Playful', 'Fredoka', 'Nunito'),
  elegant: pair('Elegant', 'Cinzel', 'Montserrat'),
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
export const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (h: string, to: number, t: number) => hex(rgb(h).map((v) => v + (to - v) * t));
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Light tint of the primary behind near-black text (always >= 4.5:1); the heading colour is the primary,
// darkened until it reads at >= 3:1 on that background.
export function deriveScheme(primary: string, accent: string): Scheme {
  const background = mix(primary, 255, 0.92);
  let heading = primary;
  for (let t = 0.1; contrast(heading, background) < 3 && t <= 1; t += 0.1) heading = mix(primary, 0, t);
  return { primary: heading, accent, background, text: '#1a1a1a' };
}

// fg nudged darker or lighter, whichever reaches `min` first, until it reads on bg. For display type and ornaments.
// Bounded: at full strength it is black or white, and one of those is always above 4.5:1 on any background.
export function displaySafe(fg: string, bg: string, min = 3): string {
  if (!HEX_RE.test(fg) || !HEX_RE.test(bg) || contrast(fg, bg) >= min) return fg;
  for (let i = 1; i <= 20; i++) for (const to of [0, 255]) {
    const c = mix(fg, to, i / 20);
    if (contrast(c, bg) >= min) return c;
  }
  return fg;
}

// RSVP field colours: the page background moved 8% toward the text, with the text kept at >= 4.5:1 on it.
// Computed here rather than with color-mix(), which older iOS cannot render.
export function fieldColors(bg: string, fg: string): { bg: string; fg: string } {
  if (!HEX_RE.test(bg) || !HEX_RE.test(fg)) return { bg, fg };
  const field = hex(rgb(bg).map((v, i) => v + (rgb(fg)[i] - v) * 0.08));
  return { bg: field, fg: displaySafe(fg, field, 4.5) };
}

// True when a is the darker colour of the pair (Starlight keeps a dark scheme's sky).
export const isDark = (a: string, b: string) => lum(a) <= lum(b);

const TONES = ['dark', 'light', 'scheme'];
const inRange = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const extra = (o: object, allowed: string[]) => Object.keys(o).find((k) => !allowed.includes(k));

// photoCount checks an index (checkout); photoKeys checks a stored key (manage page).
export function validateStyle(input: unknown, opts: { photoCount?: number; photoKeys?: string[]; tier?: Tier; trackIds?: number[] } = {}): { style: InvitationStyle } | { error: string } {
  if (input == null) return { style: {} };
  if (typeof input !== 'object' || Array.isArray(input)) return { error: 'Style must be an object.' };
  const s = input as Record<string, any>;
  const bad = extra(s, ['v', 'font', 'colors', 'cover', 'intro', 'music']);
  if (bad) return { error: `Unknown style field: ${bad}.` };
  if ((s.intro !== undefined || s.music !== undefined) && opts.tier !== 'premium') return { error: 'Opening animation and music are Premium features.' };
  if (s.intro !== undefined && typeof s.intro !== 'boolean') return { error: 'Intro must be true or false.' };
  if (s.music !== undefined && !(Number.isInteger(s.music) && opts.trackIds?.includes(s.music))) return { error: 'Unknown music track.' };
  if (s.v !== undefined && s.v !== 1) return { error: 'Style version must be 1.' };
  if (s.font !== undefined && !(typeof s.font === 'string' && Object.prototype.hasOwnProperty.call(FONT_PAIRS, s.font))) return { error: 'Unknown font.' };
  if (s.colors !== undefined) {
    const c = s.colors;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Colours must be an object.' };
    const e = extra(c, ['primary', 'accent']);
    if (e) return { error: `Unknown colour field: ${e}.` };
    for (const k of ['primary', 'accent']) if (typeof c[k] !== 'string' || !HEX_RE.test(c[k])) return { error: `Colour ${k} must be a #rrggbb value.` };
    const d = deriveScheme(c.primary, c.accent);
    if (contrast(d.text, d.background) < 4.5) return { error: 'Text and background colours need a contrast of at least 4.5:1.' };
  }
  if (s.cover !== undefined) {
    const c = s.cover;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Cover must be an object.' };
    const e = extra(c, ['photo', 'x', 'y', 'zoom', 'tone', 'strength', 'fade']);
    if (e) return { error: `Unknown cover field: ${e}.` };
    const keys = opts.photoKeys;
    const okPhoto = typeof c.photo === 'string'
      ? !!keys?.includes(c.photo)
      : Number.isInteger(c.photo) && c.photo >= 0 && c.photo < (opts.photoCount ?? keys?.length ?? 0);
    if (!okPhoto) return { error: 'Cover photo must be one of the uploaded photos.' };
    if (!inRange(c.x, 0, 100)) return { error: 'Cover x must be between 0 and 100.' };
    if (!inRange(c.y, 0, 100)) return { error: 'Cover y must be between 0 and 100.' };
    if (!inRange(c.zoom, 1, 3)) return { error: 'Cover zoom must be between 1 and 3.' };
    if (!TONES.includes(c.tone)) return { error: 'Cover tone must be dark, light or scheme.' };
    if (!inRange(c.strength, 0, 0.8)) return { error: 'Cover strength must be between 0 and 0.8.' };
    if (typeof c.fade !== 'boolean') return { error: 'Cover fade must be true or false.' };
  }
  return { style: s as InvitationStyle };
}

const withoutCover = ({ cover: _c, ...rest }: InvitationStyle): InvitationStyle => rest;

// Checkout: turn the cover's photo index into the stored photo key.
export function coverIndexToKey(style: InvitationStyle, keys: string[]): InvitationStyle {
  const c = style.cover;
  if (!c || typeof c.photo !== 'number') return style;
  const key = keys[c.photo];
  return key === undefined ? withoutCover(style) : { ...style, cover: { ...c, photo: key } };
}

// Photos were reordered or removed: the cover follows its photo's key, or is dropped.
export function remapCover(style: InvitationStyle, oldKeys: string[], newKeys: string[]): InvitationStyle {
  const c = style.cover;
  if (!c) return style;
  const key = typeof c.photo === 'number' ? oldKeys[c.photo] : c.photo;
  return key !== undefined && newKeys.includes(key) ? { ...style, cover: { ...c, photo: key } } : withoutCover(style);
}
