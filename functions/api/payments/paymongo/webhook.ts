/// <reference types="@cloudflare/workers-types" />
import { confirmPayment, transition } from '../../../../server/orders';
import { notify } from '../../../../server/order-emails';
import { verifyPaymongoSignature } from '../../../../server/paymongo';

interface Env {
  DB: D1Database;
  PAYMONGO_SECRET_KEY?: string;
  PAYMONGO_WEBHOOK_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

// PayMongo is not used in the customer flow; this only settles legacy/test checkouts via confirmPayment.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const raw = await request.text();
  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json({ error: 'Invalid signature.' }, 401); }
  if (!env.PAYMONGO_WEBHOOK_SECRET) console.error('PayMongo webhook: PAYMONGO_WEBHOOK_SECRET is not set');
  const valid = !!env.PAYMONGO_WEBHOOK_SECRET && await verifyPaymongoSignature(
    request.headers.get('Paymongo-Signature'), raw, env.PAYMONGO_WEBHOOK_SECRET, evt?.data?.attributes?.livemode === true, Math.floor(Date.now() / 1000));
  if (!valid) return json({ error: 'Invalid signature.' }, 401);

  const eventId = String(evt.data?.id ?? '');
  const type = String(evt.data?.attributes?.type ?? '');
  if (!eventId) return json({ error: 'Missing event id.' }, 400);
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payment_events (paymongo_event_id, type, payload) VALUES (?, ?, ?)').bind(eventId, type, raw).run();
  // Repeats are processed again (the status guards make that safe), so a retry after a crash
  // mid-processing still activates the order. Only the refund audit row is kept to the first delivery.
  const firstDelivery = ins.meta.changes > 0;

  try {
    if (type !== 'checkout_session.payment.paid') return json({ ok: true });
    const session = evt.data.attributes.data ?? {};
    const order = await env.DB.prepare('SELECT id, reference, status, amount_centavos FROM orders WHERE paymongo_checkout_id = ?')
      .bind(String(session.id ?? '')).first<any>();
    if (!order) return json({ ok: true });
    await env.DB.prepare('UPDATE payment_events SET order_id = ? WHERE paymongo_event_id = ?').bind(order.id, eventId).run();
    if (order.status === 'cancelled' || order.status === 'refunded') {
      // Money arrived for an order that can no longer proceed: answer 200 so PayMongo stops retrying; refund by hand
      if (firstDelivery) {
        const message = `Payment arrived for ${order.status} order ${order.reference} (id ${order.id}); nothing was activated. Refund it in PayMongo.`;
        console.error('PayMongo webhook:', message);
        await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)").bind(new Date().toISOString(), message).run();
      }
      return json({ ok: true });
    }
    // Every step below is resumable: a retry after a mid-processing failure continues where it stopped
    if (order.status === 'payment_confirmed') {
      const next = await transition(env.DB, order.id, 'for_review', { actor: 'system' });
      if (!next.ok) throw new Error(next.error);
    } else if (order.status === 'pending_payment' || order.status === 'payment_verification') {
      if (order.status === 'pending_payment') {
        const moved = await transition(env.DB, order.id, 'payment_verification', { actor: 'paymongo' });
        if (!moved.ok) throw new Error(moved.error);
      }
      let pay = await env.DB.prepare("SELECT id FROM payments WHERE order_id = ? AND provider = 'paymongo' AND status = 'submitted' ORDER BY id LIMIT 1").bind(order.id).first<any>();
      if (!pay) {
        const ins2 = await env.DB.prepare("INSERT INTO payments (order_id, provider, amount_centavos, status, customer_reference, submitted_at) VALUES (?, 'paymongo', ?, 'submitted', ?, ?)")
          .bind(order.id, order.amount_centavos, session.attributes?.payments?.[0]?.id ?? null, new Date().toISOString()).run();
        pay = { id: ins2.meta.last_row_id };
      }
      const done = await confirmPayment(env.DB, pay.id, { actor: 'paymongo' });
      if (!done.ok) throw new Error(done.error);
    } else return json({ ok: true }); // past review already (repeat delivery)
    context.waitUntil(notify(env.DB, request, order.id, 'confirmed'));
    return json({ ok: true });
  } catch (e) {
    // Forget the event so PayMongo's retry is processed instead of skipped as a duplicate
    console.error('PayMongo webhook error:', e instanceof Error ? e.message : e);
    await env.DB.prepare('DELETE FROM payment_events WHERE paymongo_event_id = ?').bind(eventId).run();
    return json({ error: 'Webhook processing failed.' }, 500);
  }
};
