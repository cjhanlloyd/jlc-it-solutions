/// <reference types="@cloudflare/workers-types" />
// Expires unpaid orders and purges guest data after the event (privacy notice: 60 days).
// Safe to run repeatedly or concurrently: every write is conditional, and R2 deletes of missing keys are no-ops.
import { isPastExpiry } from './guest-invitation';

const keysOf = (photos: string) => { try { const k = JSON.parse(photos); return Array.isArray(k) ? k as string[] : []; } catch { return []; } };

// Photos go first: if R2 fails the row is left for the next run instead of losing track of its keys.
async function deletePhotos(photos: R2Bucket, keys: string[], what: string): Promise<boolean> {
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

  // created_at is CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS', UTC). 'expired' rows whose invitation
  // still exists are retries after an R2 failure.
  const cutoff = new Date(now.getTime() - 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
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

  // 'expired' rows are included because the guest page marks them lazily without purging.
  const { results: live } = await db.prepare(
    "SELECT id, event_date, photos FROM invitations WHERE status = 'live' OR (status = 'expired' AND (photos != '[]' OR id IN (SELECT invitation_id FROM rsvps)))",
  ).all<any>();
  for (const i of (live || []).filter((x) => isPastExpiry(x.event_date, now))) {
    if (!await deletePhotos(photos, keysOf(i.photos), `invitation ${i.id}`)) continue;
    await db.batch([
      db.prepare("UPDATE invitations SET status = 'expired', photos = '[]' WHERE id = ? AND status IN ('live', 'expired')").bind(i.id),
      db.prepare('DELETE FROM rsvps WHERE invitation_id = ?').bind(i.id),
    ]);
    purgedInvitations++;
  }
  return { expiredOrders, purgedInvitations };
}
