/// <reference types="@cloudflare/workers-types" />
// Expires unpaid orders and purges guest data after the event (privacy notice: 60 days).
// Safe to run repeatedly or concurrently: every write is conditional, and R2 deletes of missing keys are no-ops.
import { occasionOf } from '../shared/occasions';
import { isPastExpiry } from './guest-invitation';
import { expireIfOverdue } from './orders';

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

export async function runCleanup(db: D1Database, photos: R2Bucket, now: Date): Promise<{ expiredOrders: number; purgedInvitations: number; purgedReceipts: number }> {
  let expiredOrders = 0, purgedInvitations = 0, purgedReceipts = 0;

  // Unpaid orders past their deadline → cancelled (expireIfOverdue deletes the pending invitation, photos first).
  const { results: overdue } = await db.prepare(
    "SELECT o.id, o.status, o.payment_deadline, o.product_id AS invitation_id FROM orders o WHERE o.status = 'pending_payment' AND o.payment_deadline < ?",
  ).bind(now.toISOString()).all<any>();
  for (const o of overdue || []) if (await expireIfOverdue(db, photos, o, now)) expiredOrders++;

  // Cancelled orders whose invitation is still pending: an earlier R2 delete failed, or an admin cancelled.
  const { results: stuck } = await db.prepare(
    "SELECT o.id, i.id AS invitation_id, i.photos FROM orders o JOIN invitations i ON i.id = o.product_id WHERE o.status = 'cancelled' AND i.status = 'pending'",
  ).all<any>();
  for (const o of stuck || []) {
    if (!await deletePhotos(photos, keysOf(o.photos), `order ${o.id}`)) continue;
    await db.prepare("DELETE FROM invitations WHERE id = ? AND status = 'pending'").bind(o.invitation_id).run();
  }

  // Receipts of orders cancelled > 60 days ago (orders.updated_at is stamped by every status move). datetime()
  // normalises both ISO values and legacy 'YYYY-MM-DD HH:MM:SS' ones. Receipts of other orders are kept (accounting).
  const { results: old } = await db.prepare(
    "SELECT id FROM orders WHERE status = 'cancelled' AND updated_at IS NOT NULL AND datetime(updated_at) < datetime(?)",
  ).bind(new Date(now.getTime() - 60 * 86_400_000).toISOString()).all<any>();
  for (const o of old || []) {
    const { objects } = await photos.list({ prefix: `receipts/${o.id}/` });
    if (!objects.length) continue;
    if (await deletePhotos(photos, objects.map((x) => x.key), `receipts of order ${o.id}`)) purgedReceipts++;
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
  return { expiredOrders, purgedInvitations, purgedReceipts };
}
