// Design validation for the admin designs API (moved from the old invitations admin route).
import { occasionOf } from '../shared/occasions';
import { fromPrice, validatePackages } from '../shared/packages';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const MEDIA_PATH_RE = /^\/media\/design\/[A-Za-z0-9._-]+$/;
const MAX_IMAGES = 6;

// A preview image is an https URL, an already-uploaded /media/design/ path, or a new image data URL (uploaded by the caller).
const imageOk = (u: unknown) => typeof u === 'string' && (/^https:\/\/\S+$/.test(u) || MEDIA_PATH_RE.test(u) || u.startsWith('data:image/'));

// Returns the cleaned design (preview images and sample photos still raw), or an error message.
export function validateDesign(b: any): { ok: true; d: any } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 80) return bad('Name must be 1 to 80 characters.');
  if (typeof b.slug !== 'string' || b.slug.length > 60 || !SLUG_RE.test(b.slug)) return bad('Slug must be lowercase letters, numbers and single hyphens (max 60).');
  const occasion = occasionOf(b.productType);
  if (!occasion) return bad('Unknown product type.');
  if (!occasion.layouts.includes(b.layoutKey)) return bad(`Layout ${b.layoutKey} is not a ${occasion.label} layout.`);
  const schemes = b.colorSchemes;
  const schemeOk = (s: any) => s && typeof s.name === 'string' && s.name.trim() && ['primary', 'accent', 'background', 'text'].every((k) => typeof s[k] === 'string' && HEX_RE.test(s[k]));
  if (!Array.isArray(schemes) || !schemes.length || !schemes.every(schemeOk)) return bad('Color schemes need a name and #rrggbb primary, accent, background and text.');
  const imgs = b.previewImages;
  if (!Array.isArray(imgs) || !imgs.every(imageOk)) return bad('Preview images must be https URLs, uploaded images or new JPEG, PNG or WebP images.');
  if (imgs.length > MAX_IMAGES) return bad(`A design can have up to ${MAX_IMAGES} preview images.`);
  const samples = b.samplePhotos ?? [];
  if (!Array.isArray(samples) || !samples.every(imageOk)) return bad('Sample photos must be https URLs, uploaded images or new JPEG, PNG or WebP images.');
  if (samples.length > MAX_IMAGES) return bad(`A design can have up to ${MAX_IMAGES} sample photos.`);
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length > 600) return bad('Description must be 600 characters or fewer.');
  const v = occasion.validateDetails(b.sampleDetails);
  if (v.ok === false) return bad(`Sample details: ${v.error}`);
  const p = validatePackages(b.packages);
  if (p.ok === false) return bad(p.error);
  return { ok: true, d: {
    slug: b.slug, name, product_type: b.productType, layout_key: b.layoutKey, images: imgs as string[], samples: samples as string[],
    color_schemes: JSON.stringify(schemes.map((s: any) => ({ name: s.name.trim(), primary: s.primary, accent: s.accent, background: s.background, text: s.text }))),
    sample_details: JSON.stringify(v.details), active: b.active === false ? 0 : 1, description, featured: b.featured === true ? 1 : 0,
    packages: JSON.stringify(p.packages), price_centavos: fromPrice(p.packages),
  } };
}
