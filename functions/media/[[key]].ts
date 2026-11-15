/// <reference types="@cloudflare/workers-types" />
// Public portal images. Serves only keys under media/ in the shared PHOTOS bucket.
import { SECURITY_HEADERS } from '../../server/security-headers';

interface Env { PHOTOS: R2Bucket }

const NOT_FOUND = () => new Response('Not found', { status: 404 });
const REST = /^[a-z]+\/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const path = new URL(request.url).pathname;
  let rest: string;
  try { rest = decodeURIComponent(path.slice('/media/'.length)); } catch { return NOT_FOUND(); }
  // The strict pattern alone rules out '..', leading '/', backslashes and encoded traversal
  if (!path.startsWith('/media/') || !REST.test(rest)) return NOT_FOUND();
  const obj = await env.PHOTOS.get('media/' + rest);
  if (!obj) return NOT_FOUND();
  return new Response(obj.body, { headers: {
    ...SECURITY_HEADERS,
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
};
