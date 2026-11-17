/// <reference types="@cloudflare/workers-types" />
// Public portal images. Serves only keys under media/ in the shared PHOTOS bucket.
import { r2Response } from '../../server/r2-response';
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
  const res = await r2Response(env.PHOTOS, 'media/' + rest, request, { ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=31536000, immutable' });
  return res ?? NOT_FOUND();
};
