import { decodeImage } from './images';

// Portal-managed public images (designs, testimonials, brand) live under media/ in the shared PHOTOS bucket.
const MAX_BYTES = 2_000_000;
const TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function putMedia(photos: R2Bucket, kind: 'design' | 'testimonial' | 'brand', dataUrl: unknown): Promise<{ key: string } | { error: string }> {
  const img = decodeImage(dataUrl, MAX_BYTES);
  if (img === 'type') return { error: 'Upload a JPEG, PNG or WebP image' };
  if (img === 'size') return { error: 'Image must be 2 MB or smaller' };
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const key = `media/${kind}/${Date.now()}-${rand}.${img.ext}`;
  await photos.put(key, img.bytes, { httpMetadata: { contentType: TYPES[img.type] } });
  return { key };
}

export const mediaUrl = (key: string) => '/media/' + key.slice('media/'.length);

export async function deleteMedia(photos: R2Bucket, key: string): Promise<void> {
  if (key.startsWith('media/')) await photos.delete(key);
}
