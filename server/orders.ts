/// <reference types="@cloudflare/workers-types" />
// Order lifecycle writes. Every status change is a conditional UPDATE plus its event in one batch,
// so a concurrent change makes the second writer fail cleanly instead of overwriting.
import { canTransition, STATUS_LABEL, type OrderStatus } from '../shared/order-status';
import { deletePhotos, keysOf } from './cleanup';

export type Result = { ok: true; [k: string]: unknown } | { ok: false; error: string };
type Actor = { actor: string; note?: string; visible?: boolean };

const CHANGED = 'The order changed meanwhile. Reload and try again.';
const NOT_FOUND = 'Order not found.';
// Appended to a statement that must only run if the previous statement in the batch changed one row
const AFTER_PREV = ' AND changes() = 1';
const label = (s: string) => STATUS_LABEL[s as OrderStatus] ?? s;

// [UPDATE orders, INSERT its status event]; the event is written only if the UPDATE matched.
function move(db: D1Database, orderId: number, from: string, to: OrderStatus, o: Actor, at: string, guard = '', guardArgs: unknown[] = []) {
  return [
    db.prepare(`UPDATE orders SET status = ?1, updated_at = ?2, delivered_at = CASE WHEN ?1 = 'delivered' THEN ?2 ELSE delivered_at END WHERE id = ?3 AND status = ?4${guard}`)
      .bind(to, at, orderId, from, ...guardArgs),
    db.prepare("INSERT INTO order_events (order_id, at, actor, kind, from_status, to_status, note, visible) SELECT ?, ?, ?, 'status', ?, ?, ?, ? WHERE changes() = 1")
      .bind(orderId, at, o.actor, from, to, o.note ?? null, o.visible === false ? 0 : 1),
  ];
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newReference(): string {
  let s = '';
  // 248 = 8 * 31: rejecting higher bytes keeps every character equally likely
  while (s.length < 6) for (const b of crypto.getRandomValues(new Uint8Array(8))) if (b < 248 && s.length < 6) s += ALPHABET[b % 31];
  return `JLC-${s}`;
}

export async function transition(db: D1Database, orderId: number, to: OrderStatus, opts: Actor, now = new Date()): Promise<{ ok: true; from: OrderStatus } | { ok: false; error: string }> {
  const row = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(orderId).first<{ status: OrderStatus }>();
  if (!row) return { ok: false, error: NOT_FOUND };
  if (!canTransition(row.status, to)) return { ok: false, error: `An order in ${label(row.status)} cannot move to ${label(to)}.` };
  const [upd] = await db.batch(move(db, orderId, row.status, to, opts, now.toISOString()));
  return upd.meta.changes ? { ok: true, from: row.status } : { ok: false, error: CHANGED };
}

export async function addEvent(db: D1Database, orderId: number, e: { actor: string; kind: 'note' | 'assign' | 'payment'; note: string; visible?: boolean }): Promise<void> {
  await db.prepare('INSERT INTO order_events (order_id, at, actor, kind, note, visible) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(orderId, new Date().toISOString(), e.actor, e.kind, e.note, e.visible ? 1 : 0).run();
}

const PAYMENT_SQL = 'SELECT p.status, p.order_id, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?';
async function reviewable(db: D1Database, paymentId: number): Promise<{ order_id: number } | string> {
  const p = await db.prepare(PAYMENT_SQL).bind(paymentId).first<any>();
  if (!p) return 'Payment not found.';
  if (p.status !== 'submitted') return 'This payment was already reviewed.';
  if (p.order_status !== 'payment_verification') return 'The order is not waiting for payment verification.';
  return p;
}
// Payment row changes only while it is submitted and its order is in payment verification
const PAYMENT_GUARD = "WHERE id = ? AND status = 'submitted' AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'payment_verification')";

export async function confirmPayment(db: D1Database, paymentId: number, o: { actor: string; adminReference?: string }): Promise<Result> {
  const p = await reviewable(db, paymentId);
  if (typeof p === 'string') return { ok: false, error: p };
  const at = new Date().toISOString();
  const [paid] = await db.batch([
    db.prepare(`UPDATE payments SET status = 'confirmed', verified_by = ?, verified_at = ?, admin_reference = ? ${PAYMENT_GUARD}`)
      .bind(o.actor, at, o.adminReference ?? null, paymentId, p.order_id),
    ...move(db, p.order_id, 'payment_verification', 'payment_confirmed', { actor: o.actor }, at, AFTER_PREV),
  ]);
  if (!paid.meta.changes) return { ok: false, error: 'This payment was already reviewed, or the order changed meanwhile. Reload and try again.' };
  // Phase 2 sells templates only: a confirmed order goes straight to review
  const next = await transition(db, p.order_id, 'for_review', { actor: 'system' });
  if ('error' in next) console.error(`confirmPayment: order ${p.order_id} confirmed but not moved to review: ${next.error}`);
  return { ok: true, orderId: p.order_id };
}

export async function rejectPayment(db: D1Database, paymentId: number, o: { actor: string; reason: string }, now = new Date()): Promise<Result> {
  const reason = String(o.reason ?? '').trim();
  if (!reason || reason.length > 300) return { ok: false, error: 'A reason of up to 300 characters is required.' };
  const p = await reviewable(db, paymentId);
  if (typeof p === 'string') return { ok: false, error: p };
  const at = now.toISOString();
  const [rejected] = await db.batch([
    db.prepare(`UPDATE payments SET status = 'rejected', note = ?, verified_by = ?, verified_at = ? ${PAYMENT_GUARD}`)
      .bind(reason, o.actor, at, paymentId, p.order_id),
    ...move(db, p.order_id, 'payment_verification', 'pending_payment', { actor: o.actor, note: reason, visible: true }, at, AFTER_PREV),
    // At least 24 h from now to re-upload (ISO strings compare in time order); runs only if the event above was written
    db.prepare("UPDATE orders SET payment_deadline = max(COALESCE(payment_deadline, ''), ?) WHERE id = ? AND changes() = 1")
      .bind(new Date(now.getTime() + 24 * 3_600_000).toISOString(), p.order_id),
  ]);
  if (!rejected.meta.changes) return { ok: false, error: 'This payment was already reviewed, or the order changed meanwhile. Reload and try again.' };
  return { ok: true, orderId: p.order_id };
}

export async function deliver(db: D1Database, orderId: number, o: { actor: string }): Promise<Result> {
  const order = await db.prepare('SELECT status, product_id FROM orders WHERE id = ?').bind(orderId).first<any>();
  if (!order) return { ok: false, error: NOT_FOUND };
  if (order.status !== 'for_review' && order.status !== 'completed') return { ok: false, error: 'Only an order that is For Review or Completed can be delivered.' };
  // The invitation goes live only while the order is unchanged, and the order moves only if it did
  const [, upd] = await db.batch([
    db.prepare("UPDATE invitations SET status = 'live' WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ?)")
      .bind(order.product_id, orderId, order.status),
    ...move(db, orderId, order.status, 'delivered', { actor: o.actor }, new Date().toISOString(), AFTER_PREV),
  ]);
  return upd.meta.changes ? { ok: true } : { ok: false, error: 'The invitation is not waiting to go live, or the order changed meanwhile. Reload and try again.' };
}

// Status only: the money is returned by hand in GCash, and photos go with the 60-day purge.
export async function refund(db: D1Database, _photos: R2Bucket, orderId: number, o: { actor: string; note?: string }): Promise<Result> {
  const order = await db.prepare('SELECT status, product_id FROM orders WHERE id = ?').bind(orderId).first<any>();
  if (!order) return { ok: false, error: NOT_FOUND };
  if (!canTransition(order.status, 'refunded')) return { ok: false, error: `An order in ${label(order.status)} cannot be refunded.` };
  const [upd] = await db.batch([
    ...move(db, orderId, order.status, 'refunded', { actor: o.actor, note: o.note }, new Date().toISOString()),
    db.prepare("UPDATE invitations SET status = 'refunded' WHERE id = ? AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'refunded')")
      .bind(order.product_id, orderId),
  ]);
  return upd.meta.changes ? { ok: true } : { ok: false, error: CHANGED };
}

// payment_deadline is an ISO timestamp. Returns true if this call cancelled the order.
export async function expireIfOverdue(db: D1Database, photos: R2Bucket, order: { id: number; status: string; payment_deadline: string | null; invitation_id: number }, now: Date): Promise<boolean> {
  if (order.status !== 'pending_payment' || !order.payment_deadline || !(Date.parse(order.payment_deadline) < now.getTime())) return false;
  // Re-checked in SQL: a receipt upload or deadline extension since the caller's read wins
  const at = now.toISOString();
  const [upd] = await db.batch(move(db, order.id, 'pending_payment', 'cancelled', { actor: 'system', note: 'Payment deadline passed' }, at, ' AND payment_deadline < ?5', [at]));
  if (!upd.meta.changes) return false;
  const inv = await db.prepare("SELECT photos FROM invitations WHERE id = ? AND status = 'pending'").bind(order.invitation_id).first<any>();
  // Photos first: if R2 fails the row stays, so its keys are not lost
  if (inv && await deletePhotos(photos, keysOf(inv.photos), `order ${order.id}`)) {
    await db.prepare("DELETE FROM invitations WHERE id = ? AND status = 'pending'").bind(order.invitation_id).run();
  }
  return true;
}
