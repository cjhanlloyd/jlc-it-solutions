/// <reference types="@cloudflare/workers-types" />
// Guest photo uploads (Premium) and their moderation, shared by the organiser routes and the shop admin routes.
// Uploads are always stored as 'pending' (the column default is 'approved'); /photos/ serves only approved ones.
import { findGuestInvitation } from './guest-invitation';
import { guestPhotosOn, photoError, putPhoto } from './event-features';
import { r2Response } from './r2-response';
import { SECURITY_HEADERS } from './security-headers';
import { turnstileError } from './turnstile';
import { GUEST_PHOTOS_MAX, GUEST_UPLOAD_PER_BATCH } from '../shared/extras';

interface Env { DB: D1Database; PHOTOS: R2Bucket; TURNSTILE_SECRET_KEY?: string }

const json = (data: unknown, status = 200) => Response.json(data, { status });
const GUEST_NAME_MAX = 60;
const UPLOADS_PER_HOUR = 20;

const rand6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

// POST /i/<slug>/photos { name, photos: dataURL[] (1-5), guestToken?, turnstileToken } -> { saved, full? }
export async function guestPhotoUpload(slug: string, request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const inv = await findGuestInvitation(env.DB, slug);
  if (inv?.status !== 'live') return json({ error: 'Invitation not found.' }, 404);
  if (!guestPhotosOn(inv)) return json({ error: 'This invitation is not accepting photos.' }, 403);

  const g = typeof body.guestToken === 'string' && body.guestToken
    ? await env.DB.prepare('SELECT id, name FROM invitation_guests WHERE token = ? AND invitation_id = ?').bind(body.guestToken, inv.id).first<any>() : null;
  const name = g ? g.name : typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > (g ? 200 : GUEST_NAME_MAX)) return json({ error: `Please enter your name (up to ${GUEST_NAME_MAX} characters).` }, 400);
  const photos: unknown = body.photos;
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > GUEST_UPLOAD_PER_BATCH) return json({ error: `Please choose 1 to ${GUEST_UPLOAD_PER_BATCH} photos.` }, 400);
  for (const p of photos) { const err = photoError(p); if (err) return json({ error: err }, 400); }

  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;
  const message = `Guest photos from ${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE log_type = 'guest_photo' AND message = ? AND timestamp > ?")
    .bind(message, new Date(Date.now() - 3_600_000).toISOString()).first<any>();
  if ((recent?.count || 0) >= UPLOADS_PER_HOUR) return json({ error: 'Too many uploads. Please try again later.' }, 429);
  await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'guest_photo', ?)").bind(new Date().toISOString(), message).run();

  let saved = 0;
  for (const p of photos as string[]) {
    const key = await putPhoto(env, inv.id, `guest-${Date.now()}-${rand6()}`, p);
    try {
      // One statement, so the per-invitation cap holds under concurrent uploads
      const ins = await env.DB.prepare(
        `INSERT INTO invitation_media (invitation_id, kind, r2_key, guest_name, guest_id, status) SELECT ?, 'guest', ?, ?, ?, 'pending' WHERE (SELECT COUNT(*) FROM invitation_media WHERE invitation_id = ? AND kind = 'guest') < ${GUEST_PHOTOS_MAX}`,
      ).bind(inv.id, key, name, g?.id ?? null, inv.id).run();
      if (!ins.meta.changes) { await env.PHOTOS.delete(key); return json({ saved, full: true }); }
      saved++;
    } catch (e) {
      await env.PHOTOS.delete(key);
      throw e;
    }
  }
  return json({ saved });
}

// Every guest photo of one invitation with counts, for the organiser and the admin
export async function listGuestPhotos(db: D1Database, invitationId: number) {
  const { results } = await db.prepare("SELECT id, guest_name, status, created_at FROM invitation_media WHERE invitation_id = ? AND kind = 'guest' ORDER BY id DESC")
    .bind(invitationId).all<any>();
  const photos = (results || []).map((r) => ({ id: r.id, guestName: r.guest_name, status: r.status as string, createdAt: r.created_at }));
  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  for (const p of photos) counts[p.status]++;
  return { photos, counts };
}

// { action: 'approve'|'reject'|'delete', id } or { action: 'approve-all' }. Ids of other invitations are 404.
export async function moderateGuestPhotos(env: Env, invitationId: number, body: any): Promise<Response> {
  const now = new Date().toISOString();
  if (body?.action === 'approve-all') {
    const r = await env.DB.prepare("UPDATE invitation_media SET status = 'approved', moderated_at = ? WHERE invitation_id = ? AND kind = 'guest' AND status = 'pending'").bind(now, invitationId).run();
    return json({ ok: true, approved: r.meta.changes });
  }
  if (!['approve', 'reject', 'delete'].includes(body?.action)) return json({ error: 'Unknown action.' }, 400);
  const row = Number.isInteger(body.id)
    ? await env.DB.prepare("SELECT id, r2_key FROM invitation_media WHERE id = ? AND invitation_id = ? AND kind = 'guest'").bind(body.id, invitationId).first<any>() : null;
  if (!row) return json({ error: 'Photo not found.' }, 404);
  if (body.action === 'delete') {
    await env.DB.prepare('DELETE FROM invitation_media WHERE id = ?').bind(row.id).run(); // row first: a failed object delete only leaves an orphan
    await env.PHOTOS.delete(row.r2_key).catch((e) => console.error('guest photo delete failed:', e instanceof Error ? e.message : e));
    return json({ ok: true });
  }
  await env.DB.prepare('UPDATE invitation_media SET status = ?, moderated_at = ? WHERE id = ?').bind(body.action === 'approve' ? 'approved' : 'rejected', now, row.id).run();
  return json({ ok: true });
}

// Any media of this invitation, whatever its status, for an already authorised caller. Never cached.
export async function mediaPreview(env: Env, invitationId: number, mediaId: number, request: Request): Promise<Response> {
  const row = await env.DB.prepare('SELECT r2_key FROM invitation_media WHERE id = ? AND invitation_id = ?').bind(mediaId, invitationId).first<any>();
  const res = row && await r2Response(env.PHOTOS, row.r2_key, request, { ...SECURITY_HEADERS, 'Cache-Control': 'private, no-store' });
  return res || json({ error: 'Photo not found.' }, 404);
}
