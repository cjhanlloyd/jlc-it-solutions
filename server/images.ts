// Image uploads arrive as base64 data URLs; the claimed type is trusted only if the magic bytes agree.
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  webp: (b) => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
};

// 'type' = not a JPEG, PNG or WebP data URL; 'size' = decoded over maxBytes.
export function decodeImage(image: unknown, maxBytes: number): { type: 'jpeg' | 'png' | 'webp'; ext: string; bytes: Uint8Array } | 'type' | 'size' {
  const m = typeof image === 'string' ? DATA_URL_RE.exec(image) : null;
  if (!m) return 'type';
  // Checked before decoding so an oversized upload is not decoded at all
  if (m[2].length * 3 / 4 > maxBytes + 2) return 'size';
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > maxBytes) return 'size';
  if (!MAGIC[m[1]](bytes)) return 'type';
  const type = m[1] as 'jpeg' | 'png' | 'webp';
  return { type, ext: type === 'jpeg' ? 'jpg' : type, bytes };
}
