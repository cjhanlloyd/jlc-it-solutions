// Per-invitation event features (attire, gallery layout, guest photos, cash gifts, photo booth, check-in).
// Dependency-free: used by the Cloudflare server and the React client.
import type { Tier } from './tiers.ts';

export const GALLERY_LAYOUTS = ['grid', 'masonry', 'carousel', 'polaroid'] as const;
export const BOOTH_FRAMES = ['classic', 'polaroid', 'film', 'floral'] as const;
export type GalleryLayout = typeof GALLERY_LAYOUTS[number];
export type BoothFrame = typeof BOOTH_FRAMES[number];
export type GiftMethod = { label: string; accountName?: string; accountNumber: string };
export type Extras = {
  attire?: { motif?: string; palette?: string[]; notes?: string };
  gallery?: { layout?: GalleryLayout };
  guestPhotos?: { enabled?: boolean };
  gifts?: { methods?: GiftMethod[] };
  booth?: { enabled?: boolean; frame?: BoothFrame };
  checkin?: { enabled?: boolean };
};

export const ATTIRE_PHOTOS_MAX = 6;
export const GUEST_UPLOAD_PER_BATCH = 5;
export const GUEST_PHOTOS_MAX = 500;
export const GIFT_ITEMS_MAX = 50;
export const EXTRAS_LIMITS = { motif: 120, palette: 6, notes: 600, methods: 4, label: 30, accountName: 60, accountNumber: 40 };

const HEX_RE = /^#[0-9a-f]{6}$/i;
type R<T> = { v: T } | { error: string };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

// Returns the object's fields after rejecting any key outside `allowed`
function group(x: unknown, name: string, allowed: string[]): R<Record<string, unknown>> {
  if (!isObj(x)) return { error: `${name} must be an object.` };
  const bad = Object.keys(x).find((k) => !allowed.includes(k));
  return bad ? { error: `Unknown setting: ${name}.${bad}.` } : { v: x };
}
function text(x: unknown, name: string, max: number, required = false): R<string> {
  if (typeof x !== 'string') return { error: `${name} must be text.` };
  const t = x.trim();
  if (required && !t) return { error: `${name} is required.` };
  return t.length > max ? { error: `${name} must be ${max} characters or fewer.` } : { v: t };
}
const flag = (x: unknown, name: string): R<boolean> => typeof x === 'boolean' ? { v: x } : { error: `${name} must be true or false.` };
const pick = <T extends string>(x: unknown, name: string, options: readonly T[]): R<T> =>
  options.includes(x as T) ? { v: x as T } : { error: `${name} must be one of: ${options.join(', ')}.` };

export function validateExtras(input: unknown, tier: Tier): { extras: Extras } | { error: string } {
  const top = group(input, 'Settings', ['attire', 'gallery', 'guestPhotos', 'gifts', 'booth', 'checkin']);
  if ('error' in top) return top;
  const L = EXTRAS_LIMITS;
  const out: Record<string, any> = {};
  for (const [key, label] of [['guestPhotos', 'Guest photos'], ['booth', 'Photo booth'], ['checkin', 'Check-in']] as const) {
    if (top.v[key] !== undefined && tier !== 'premium') return { error: `${label} is a Premium feature.` };
  }

  if (top.v.attire !== undefined) {
    const g = group(top.v.attire, 'attire', ['motif', 'palette', 'notes']);
    if ('error' in g) return g;
    const a: Record<string, unknown> = {};
    if (g.v.motif !== undefined) { const r = text(g.v.motif, 'Motif', L.motif); if ('error' in r) return r; a.motif = r.v; }
    if (g.v.notes !== undefined) { const r = text(g.v.notes, 'Attire notes', L.notes); if ('error' in r) return r; a.notes = r.v; }
    if (g.v.palette !== undefined) {
      const p = g.v.palette;
      if (!Array.isArray(p) || p.length > L.palette) return { error: `Palette can have up to ${L.palette} colours.` };
      if (!p.every((c) => typeof c === 'string' && HEX_RE.test(c))) return { error: 'Palette colours must look like #d8a7b1.' };
      a.palette = p.map((c) => c.toLowerCase());
    }
    out.attire = a;
  }
  if (top.v.gallery !== undefined) {
    const g = group(top.v.gallery, 'gallery', ['layout']);
    if ('error' in g) return g;
    out.gallery = {};
    if (g.v.layout !== undefined) { const r = pick(g.v.layout, 'Gallery layout', GALLERY_LAYOUTS); if ('error' in r) return r; out.gallery.layout = r.v; }
  }
  for (const [key, label] of [['guestPhotos', 'Guest photos'], ['checkin', 'Check-in'], ['booth', 'Photo booth']] as const) {
    if (top.v[key] === undefined) continue;
    const g = group(top.v[key], key, key === 'booth' ? ['enabled', 'frame'] : ['enabled']);
    if ('error' in g) return g;
    out[key] = {};
    if (g.v.enabled !== undefined) { const r = flag(g.v.enabled, `${label} enabled`); if ('error' in r) return r; out[key].enabled = r.v; }
    if (key === 'booth' && g.v.frame !== undefined) { const r = pick(g.v.frame, 'Booth frame', BOOTH_FRAMES); if ('error' in r) return r; out[key].frame = r.v; }
  }
  if (top.v.gifts !== undefined) {
    const g = group(top.v.gifts, 'gifts', ['methods']);
    if ('error' in g) return g;
    out.gifts = {};
    if (g.v.methods !== undefined) {
      const m = g.v.methods;
      if (!Array.isArray(m) || m.length > L.methods) return { error: `You can add up to ${L.methods} payment methods.` };
      const methods: GiftMethod[] = [];
      for (const x of m) {
        const mg = group(x, 'method', ['label', 'accountName', 'accountNumber']);
        if ('error' in mg) return mg;
        const label = text(mg.v.label, 'Method name', L.label, true); if ('error' in label) return label;
        const number = text(mg.v.accountNumber, 'Account number', L.accountNumber, true); if ('error' in number) return number;
        const method: GiftMethod = { label: label.v, accountNumber: number.v };
        if (mg.v.accountName !== undefined) { const n = text(mg.v.accountName, 'Account name', L.accountName); if ('error' in n) return n; method.accountName = n.v; }
        methods.push(method);
      }
      out.gifts.methods = methods;
    }
  }
  return { extras: out as Extras };
}
