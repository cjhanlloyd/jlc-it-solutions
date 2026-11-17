/// <reference types="@cloudflare/workers-types" />
// Serves an invitation photo from R2, only while its invitation is live and lists the key.
import { decodeSegment, isPastExpiry } from '../../server/guest-invitation';
import { r2Response } from '../../server/r2-response';
import { SECURITY_HEADERS } from '../../server/security-headers';

interface Env { DB: D1Database; PHOTOS: R2Bucket }

const NOT_FOUND = () => new Response('Not found', { status: 404 });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const key = decodeSegment(new URL(request.url).pathname.slice('/photos/'.length));
  const id = key?.match(/^inv\/(\d+)\//)?.[1];
  if (!id) return NOT_FOUND();
  const inv = await env.DB.prepare('SELECT status, event_date, tier, photos, gift_qr, music_key FROM invitations WHERE id = ?').bind(Number(id)).first<any>();
  let photos: unknown = [];
  try { photos = JSON.parse(inv?.photos || '[]'); } catch { /* treated as no photos */ }
  if (inv?.status !== 'live' || isPastExpiry(inv.event_date, new Date(), inv.tier)) return NOT_FOUND();
  const listed = Array.isArray(photos) && (photos.includes(key) || inv.gift_qr === key || inv.music_key === key);
  // Attire and guest photos live in invitation_media; only approved ones are public
  if (!listed && !await env.DB.prepare("SELECT 1 FROM invitation_media WHERE invitation_id = ? AND r2_key = ? AND status = 'approved'").bind(Number(id), key).first()) return NOT_FOUND();
  // Short so a refunded or expired invitation's photos stop being served within minutes
  return (await r2Response(env.PHOTOS, key, request, { ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=300' })) ?? NOT_FOUND();
};
