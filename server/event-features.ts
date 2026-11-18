/// <reference types="@cloudflare/workers-types" />
// Organiser and guest endpoints for attire, the wish list and cash gifts (event features).
import { turnstileError } from './turnstile';
import { ATTIRE_PHOTOS_MAX, GIFT_ITEMS_MAX, validateExtras, type Extras } from '../shared/extras';
import { LIMITS } from '../shared/invitation-fields';
import { isSafeLink } from '../shared/links';
import { tierOf } from '../shared/tiers';

interface Env { DB: D1Database; PHOTOS: R2Bucket; TURNSTILE_SECRET_KEY?: string }

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };

export const guestPhotosOn = (inv: any) => tierOf(inv) === 'premium' && parse(inv.extras, {})?.guestPhotos?.enabled === true;
const GUEST_PHOTOS_SHOWN = 200;

export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const photoError = (p: unknown): string | null =>
  typeof p !== 'string' || !PHOTO_RE.test(p) ? 'Photos must be JPEG, PNG or WebP images.'
    : p.length > LIMITS.photoChars ? 'A photo is too large.' : null;

// Stores a checked data URL in R2 as inv/<invitationId>/<n>.<ext> and returns the key.
export async function putPhoto(env: { PHOTOS: R2Bucket }, invitationId: number, n: number | string, p: string): Promise<string> {
  const [, type] = p.match(PHOTO_RE)!;
  const key = `inv/${invitationId}/${n}.${type === 'jpeg' ? 'jpg' : type}`;
  const bin = atob(p.slice(p.indexOf(',') + 1));
  await env.PHOTOS.put(key, Uint8Array.from(bin, (c) => c.charCodeAt(0)), { httpMetadata: { contentType: `image/${type}` } });
  return key;
}

// What the manage GET adds: the stored settings, attire photos and the wish list with reservations.
export async function manageFeatures(db: D1Database, inv: any) {
  const [photos, items] = await Promise.all([
    db.prepare("SELECT id, r2_key, caption FROM invitation_media WHERE invitation_id = ? AND kind = 'attire' ORDER BY id").bind(inv.id).all<any>(),
    db.prepare('SELECT * FROM gift_items WHERE invitation_id = ? ORDER BY sort_order, id').bind(inv.id).all<any>(),
  ]);
  return {
    extras: parse(inv.extras, {}),
    attirePhotos: (photos.results || []).map((p) => ({ id: p.id, key: p.r2_key, caption: p.caption })),
    giftItems: (items.results || []).map((g) => ({ id: g.id, name: g.name, note: g.note, link: g.link, priceCentavos: g.price_centavos, reservedName: g.reserved_name, reservedAt: g.reserved_at, sortOrder: g.sort_order })),
  };
}

// What guests may see. Names of reservers never leave the server; reservedByYou only for the guest holding the reservation.
export async function guestFeatures(db: D1Database, inv: any, guestId: number | null) {
  const e: Extras = parse(inv.extras, {});
  const extras: Record<string, unknown> = {};
  if (e.attire) extras.attire = e.attire;
  if (e.gallery) extras.gallery = e.gallery;
  if (e.gifts?.methods) extras.gifts = { methods: e.gifts.methods };
  for (const k of ['guestPhotos', 'booth', 'checkin'] as const) if (e[k]) extras[k] = e[k];
  const [photos, items, guest] = await Promise.all([
    db.prepare("SELECT r2_key, caption FROM invitation_media WHERE invitation_id = ? AND kind = 'attire' AND status = 'approved' ORDER BY id").bind(inv.id).all<any>(),
    db.prepare('SELECT * FROM gift_items WHERE invitation_id = ? ORDER BY sort_order, id').bind(inv.id).all<any>(),
    // Approved guest photos only, newest first
    guestPhotosOn(inv) ? db.prepare(`SELECT r2_key FROM invitation_media WHERE invitation_id = ? AND kind = 'guest' AND status = 'approved' ORDER BY id DESC LIMIT ${GUEST_PHOTOS_SHOWN}`).bind(inv.id).all<any>() : null,
  ]);
  return {
    extras,
    ...(guest ? { guestPhotos: (guest.results || []).map((p) => `/photos/${p.r2_key}`) } : {}),
    attirePhotos: (photos.results || []).map((p) => ({ url: `/photos/${p.r2_key}`, caption: p.caption })),
    giftItems: (items.results || []).map((g) => ({
      id: g.id, name: g.name, note: g.note, link: g.link, priceCentavos: g.price_centavos, reserved: g.reserved_at != null,
      ...(guestId != null && g.reserved_guest_id === guestId ? { reservedByYou: true } : {}),
    })),
  };
}

const captionOf = (x: unknown): string | { error: string } => {
  const c = x == null ? '' : typeof x === 'string' ? x.trim() : null;
  return c === null || c.length > 80 ? { error: 'A caption must be 80 characters or fewer.' } : c;
};

// Organiser routes (the caller has already resolved the managed invitation): extras, attire, attire/update, attire/delete, gifts
export async function manageFeature(feature: string, request: Request, env: Env, inv: any): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  if (feature === 'extras') {
    const v = validateExtras(body.extras, tierOf(inv));
    if ('error' in v) return json({ error: v.error }, 400);
    await env.DB.prepare('UPDATE invitations SET extras = ? WHERE id = ?').bind(JSON.stringify(v.extras), inv.id).run();
    return json({ extras: v.extras });
  }
  if (feature === 'gifts') return gifts(body, env, inv);

  if (feature === 'attire') {
    const err = photoError(body.photo);
    if (err) return json({ error: err }, 400);
    const caption = captionOf(body.caption);
    if (typeof caption !== 'string') return json({ error: caption.error }, 400);
    const key = await putPhoto(env, inv.id, `attire-${Date.now()}`, body.photo);
    try {
      // One statement, so the cap holds under concurrent uploads
      const ins = await env.DB.prepare(
        `INSERT INTO invitation_media (invitation_id, kind, r2_key, caption, status) SELECT ?, 'attire', ?, ?, 'approved' WHERE (SELECT COUNT(*) FROM invitation_media WHERE invitation_id = ? AND kind = 'attire') < ${ATTIRE_PHOTOS_MAX}`,
      ).bind(inv.id, key, caption, inv.id).run();
      if (!ins.meta.changes) { await env.PHOTOS.delete(key); return json({ error: `You can add up to ${ATTIRE_PHOTOS_MAX} attire photos.` }, 400); }
      return json({ photo: { id: ins.meta.last_row_id, key, caption } });
    } catch (e) {
      await env.PHOTOS.delete(key);
      throw e;
    }
  }
  const row = Number.isInteger(body.id)
    ? await env.DB.prepare("SELECT id, r2_key FROM invitation_media WHERE id = ? AND invitation_id = ? AND kind = 'attire'").bind(body.id, inv.id).first<any>() : null;
  if (!row) return json({ error: 'Photo not found.' }, 404);
  if (feature === 'attire/update') {
    const caption = captionOf(body.caption);
    if (typeof caption !== 'string') return json({ error: caption.error }, 400);
    await env.DB.prepare('UPDATE invitation_media SET caption = ? WHERE id = ?').bind(caption, row.id).run();
    return json({ ok: true });
  }
  await env.DB.prepare('DELETE FROM invitation_media WHERE id = ?').bind(row.id).run(); // row first: a failed object delete only leaves an orphan
  await env.PHOTOS.delete(row.r2_key).catch((e) => console.error('attire delete failed:', e instanceof Error ? e.message : e));
  return json({ ok: true });
}

// { action: 'add'|'update'|'delete'|'release'|'reorder', ... }
async function gifts(body: any, env: Env, inv: any): Promise<Response> {
  const db = env.DB;
  if (body.action === 'add' || body.action === 'update') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return json({ error: 'Please enter the gift name (up to 80 characters).' }, 400);
    const note = body.note == null ? '' : typeof body.note === 'string' ? body.note.trim() : null;
    if (note === null || note.length > 200) return json({ error: 'The note must be 200 characters or fewer.' }, 400);
    const link = body.link == null || body.link === '' ? null : typeof body.link === 'string' ? body.link.trim() : false;
    if (link === false || (link !== null && (link.length > 500 || !link.startsWith('https://') || !isSafeLink(link)))) return json({ error: 'The link must be a web address starting with https://.' }, 400);
    const price = body.priceCentavos ?? null;
    if (price !== null && (!Number.isInteger(price) || price < 100 || price > 10_000_000)) return json({ error: 'The price must be between 1 and 100,000 pesos.' }, 400);
    if (body.action === 'add') {
      const ins = await db.prepare(
        `INSERT INTO gift_items (invitation_id, name, note, link, price_centavos, sort_order) SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM gift_items WHERE invitation_id = ? HAVING COUNT(*) < ${GIFT_ITEMS_MAX}`,
      ).bind(inv.id, name, note, link, price, inv.id).run();
      return ins.meta.changes ? json({ ok: true, id: ins.meta.last_row_id }) : json({ error: `You can add up to ${GIFT_ITEMS_MAX} gifts.` }, 400);
    }
    const up = await db.prepare('UPDATE gift_items SET name = ?, note = ?, link = ?, price_centavos = ? WHERE id = ? AND invitation_id = ?').bind(name, note, link, price, body.id, inv.id).run();
    return up.meta.changes ? json({ ok: true }) : json({ error: 'Gift not found.' }, 404);
  }
  if (body.action === 'delete' || body.action === 'release') {
    const r = body.action === 'delete'
      ? await db.prepare('DELETE FROM gift_items WHERE id = ? AND invitation_id = ?').bind(body.id, inv.id).run()
      : await db.prepare('UPDATE gift_items SET reserved_name = NULL, reserved_guest_id = NULL, reserved_at = NULL WHERE id = ? AND invitation_id = ?').bind(body.id, inv.id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Gift not found.' }, 404);
  }
  if (body.action === 'reorder') {
    const { results } = await db.prepare('SELECT id FROM gift_items WHERE invitation_id = ?').bind(inv.id).all<any>();
    const have = (results || []).map((r) => r.id).sort((a, b) => a - b);
    const ids: unknown = body.ids;
    if (!Array.isArray(ids) || ids.length !== have.length || [...ids].sort((a, b) => a - b).some((x, i) => x !== have[i])) return json({ error: 'The list changed. Please reload and try again.' }, 400);
    if (ids.length) await db.batch(ids.map((id, i) => db.prepare('UPDATE gift_items SET sort_order = ? WHERE id = ? AND invitation_id = ?').bind(i + 1, id, inv.id)));
    return json({ ok: true });
  }
  return json({ error: 'Unknown action.' }, 400);
}

// Guest routes: POST /i/<slug>/gifts/reserve and /release (live invitations only)
export async function guestGift(action: 'reserve' | 'release', slug: string, request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  let name = '';
  if (action === 'reserve') {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
    if (spam) return spam;
    const message = `Gift reservation from ${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
    const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE log_type = 'gift_reserve' AND message = ? AND timestamp > ?")
      .bind(message, new Date(Date.now() - 3_600_000).toISOString()).first<any>();
    if ((recent?.count || 0) >= 20) return json({ error: 'Too many attempts. Please try again later.' }, 429);
    await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'gift_reserve', ?)").bind(new Date().toISOString(), message).run();
  }
  const inv = await env.DB.prepare("SELECT id FROM invitations WHERE slug = ? AND status = 'live'").bind(slug).first<any>();
  if (!inv) return json({ error: 'Invitation not found.' }, 404);
  const g = typeof body.guestToken === 'string' && body.guestToken
    ? await env.DB.prepare('SELECT id, name FROM invitation_guests WHERE token = ? AND invitation_id = ?').bind(body.guestToken, inv.id).first<any>() : null;
  if (!Number.isInteger(body.itemId)) return json({ error: 'Gift not found.' }, 404);

  if (action === 'reserve') {
    if (g) name = g.name;
    if (!name || name.length > 80) return json({ error: 'Please enter your name (up to 80 characters).' }, 400);
    const up = await env.DB.prepare('UPDATE gift_items SET reserved_name = ?, reserved_guest_id = ?, reserved_at = ? WHERE id = ? AND invitation_id = ? AND reserved_at IS NULL')
      .bind(name, g?.id ?? null, new Date().toISOString(), body.itemId, inv.id).run();
    if (up.meta.changes) return json({ ok: true });
    const exists = await env.DB.prepare('SELECT 1 AS x FROM gift_items WHERE id = ? AND invitation_id = ?').bind(body.itemId, inv.id).first();
    return exists ? json({ error: 'Someone already chose this gift.' }, 409) : json({ error: 'Gift not found.' }, 404);
  }
  if (!g) return json({ error: 'Only the guest who chose this gift can cancel it.' }, 403);
  const up = await env.DB.prepare('UPDATE gift_items SET reserved_name = NULL, reserved_guest_id = NULL, reserved_at = NULL WHERE id = ? AND invitation_id = ? AND reserved_guest_id = ?')
    .bind(body.itemId, inv.id, g.id).run();
  return up.meta.changes ? json({ ok: true }) : json({ error: 'Only the guest who chose this gift can cancel it.' }, 403);
}
