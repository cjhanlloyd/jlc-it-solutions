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

const MAX_AUDIO_BYTES = 8_000_000;
const AUDIO_URL = /^data:audio\/(?:mpeg|mp3);base64,([A-Za-z0-9+/]*={0,2})$/;

export async function putAudio(photos: R2Bucket, dataUrl: unknown): Promise<{ key: string } | { error: string }> {
  const m = typeof dataUrl === 'string' ? AUDIO_URL.exec(dataUrl) : null;
  if (!m) return { error: 'Upload an MP3 file' };
  // Size from the base64 length, before decoding
  if (Math.floor((m[1].length * 3) / 4) > MAX_AUDIO_BYTES) return { error: 'Audio must be 8 MB or smaller' };
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const frame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  if (!id3 && !frame) return { error: 'Upload an MP3 file' };
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const key = `media/music/${Date.now()}-${rand}.mp3`;
  await photos.put(key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });
  return { key };
}

export const mediaUrl =(key: string) => '/media/' + key.slice('media/'.length);

export async function deleteMedia(photos: R2Bucket, key: string): Promise<void> {
  if (key.startsWith('media/')) await photos.delete(key);
}
