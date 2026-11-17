/// <reference types="@cloudflare/workers-types" />
// Public portal images. Serves only keys under media/ in the shared PHOTOS bucket.
import { SECURITY_HEADERS } from '../../server/security-headers';

interface Env { PHOTOS: R2Bucket }

const NOT_FOUND = () => new Response('Not found', { status: 404 });
const REST = /^[a-z]+\/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$|^music\/[0-9]+-[a-z0-9]{8}\.mp3$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const path = new URL(request.url).pathname;
  let rest: string;
  try { rest = decodeURIComponent(path.slice('/media/'.length)); } catch { return NOT_FOUND(); }
  // The strict pattern alone rules out '..', leading '/', backslashes and encoded traversal
  if (!path.startsWith('/media/') || !REST.test(rest)) return NOT_FOUND();
  // R2 reads the Range header itself; iOS Safari needs 206 to play and seek audio
  let obj: R2ObjectBody | null;
  try { obj = await env.PHOTOS.get('media/' + rest, { range: request.headers }); } catch { return new Response('Range not satisfiable', { status: 416 }); }
  if (!obj) return NOT_FOUND();
  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  let slice: { start: number; len: number } | null = null;
  if (r && obj.size > 0) {
    if (r.suffix !== undefined) { const len = Math.min(r.suffix, obj.size); slice = { start: obj.size - len, len }; }
    else slice = { start: r.offset ?? 0, len: r.length ?? obj.size - (r.offset ?? 0) };
  }
  return new Response(obj.body, { status: slice ? 206 : 200, headers: {
    ...SECURITY_HEADERS,
    'Accept-Ranges': 'bytes',
    ...(slice ? { 'Content-Range': `bytes ${slice.start}-${slice.start + slice.len - 1}/${obj.size}`, 'Content-Length': String(slice.len) } : { 'Content-Length': String(obj.size) }),
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
};
