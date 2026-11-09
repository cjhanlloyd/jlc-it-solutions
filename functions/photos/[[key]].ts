/// <reference types="@cloudflare/workers-types" />
// Serves an invitation photo from R2, only while its invitation is live and lists the key.
import { decodeSegment, isPastExpiry } from '../../server/guest-invitation';
import { SECURITY_HEADERS } from '../../server/security-headers';

interface Env { DB: D1Database; PHOTOS: R2Bucket }

const NOT_FOUND = () => new Response('Not found', { status: 404 });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const key = decodeSegment(new URL(request.url).pathname.slice('/photos/'.length));
  const id = key?.match(/^inv\/(\d+)\//)?.[1];
  if (!id) return NOT_FOUND();
  const inv = await env.DB.prepare('SELECT status, event_date, photos FROM invitations WHERE id = ?').bind(Number(id)).first<any>();
  let photos: unknown = [];
  try { photos = JSON.parse(inv?.photos || '[]'); } catch { /* treated as no photos */ }
  if (inv?.status !== 'live' || isPastExpiry(inv.event_date) || !Array.isArray(photos) || !photos.includes(key)) return NOT_FOUND();
  const obj = await env.PHOTOS.get(key);
  if (!obj) return NOT_FOUND();
  return new Response(obj.body, { headers: {
    ...SECURITY_HEADERS,
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  } });
};
