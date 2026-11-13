/// <reference types="@cloudflare/workers-types" />
// Expires unpaid orders and purges guest data after the event (privacy notice: 60 days).
// Safe to run repeatedly or concurrently: every write is conditional, and R2 deletes of missing keys are no-ops.
import { occasionOf } from '../shared/occasions';
import { isPastExpiry } from './guest-invitation';

export const keysOf = (photos: string) => { try { const k = JSON.parse(photos); return Array.isArray(k) ? k as string[] : []; } catch { return []; } };

// Photos go first: if R2 fails the row is left for the next run instead of losing track of its keys.
export async function deletePhotos(photos: R2Bucket, keys: string[], what: string): Promise<boolean> {
  try {
    if (keys.length) await photos.delete(keys);
    return true;
  } catch (e) {
    console.error(`cleanup: R2 delete failed for ${what}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export async function runCleanup(db: D1Database, photos: R2Bucket, now: Date): Promise<{ expiredOrders: number; purgedInvitations: number }> {
  let expiredOrders = 0, purgedInvitations = 0;

  // Pending for 72 h → expired: long enough that a slow PayMongo confirmation still lands on a pending order.
  // created_at is CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS', UTC). 'expired' rows whose invitation
  // still exists are retries after an R2 failure.
  const cutoff = new Date(now.getTime() - 72 * 3_600_000).toISOString().replace('T', ' ').slice(0, 19);
  const { results: stale } = await db.prepare(
    "SELECT o.id, o.status, i.id AS invitation_id, i.photos FROM orders o JOIN invitations i ON i.id = o.product_id WHERE o.status IN ('pending', 'expired') AND i.status = 'pending' AND o.created_at < ?",
  ).bind(cutoff).all<any>();
  for (const o of stale || []) {
    const r = await db.prepare("UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(o.id).run();
    if (r.meta.changes) expiredOrders++;
    else if (o.status === 'pending') continue; // paid by the webhook meanwhile
    if (!await deletePhotos(photos, keysOf(o.photos), `order ${o.id}`)) continue;
    await db.prepare("DELETE FROM invitations WHERE id = ? AND status = 'pending'").bind(o.invitation_id).run();
  }

  // 'expired' rows are included because the guest page marks them lazily without purging; 'refunded' ones
  // follow the same 60-day rule but keep their status. Rows already reduced (photos '[]', details marked
  // _purged, no RSVPs) are not selected again. The expired page and link previews keep only what the
  // occasion's title needs (expiredSummary); everything else in details is deleted.
  const { results: live } = await db.prepare(
    "SELECT i.id, i.event_date, i.photos, i.details, d.product_type FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.status = 'live' OR (i.status IN ('expired', 'refunded') AND (i.photos != '[]' OR json_extract(i.details, '$._purged') IS NULL OR i.id IN (SELECT invitation_id FROM rsvps)))",
  ).all<any>();
  for (const i of (live || []).filter((x) => isPastExpiry(x.event_date, now))) {
    const occasion = occasionOf(i.product_type);
    let summary: string;
    try {
      if (!occasion) throw new Error(`unknown product type ${i.product_type}`);
      summary = JSON.stringify(occasion.expiredSummary(JSON.parse(i.details)));
    } catch (e) {
      console.error(`cleanup: cannot purge invitation ${i.id}:`, e instanceof Error ? e.message : e);
      continue;
    }
    if (!await deletePhotos(photos, keysOf(i.photos), `invitation ${i.id}`)) continue;
    await db.batch([
      db.prepare("UPDATE invitations SET status = CASE WHEN status = 'refunded' THEN 'refunded' ELSE 'expired' END, photos = '[]', details = ? WHERE id = ? AND status IN ('live', 'expired', 'refunded')").bind(summary, i.id),
      db.prepare('DELETE FROM rsvps WHERE invitation_id = ?').bind(i.id),
    ]);
    purgedInvitations++;
  }
  return { expiredOrders, purgedInvitations };
}
