/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from '../../../server/crypto';
import { sendSmtpEmail } from '../../../server/email';
import { verifyPaymongoSignature } from '../../../server/paymongo';

interface Env {
  DB: D1Database;
  PAYMONGO_SECRET_KEY?: string;
  PAYMONGO_WEBHOOK_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const pesos = (centavos: number) => `PHP ${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The only place an order becomes 'paid'.
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
  if (!ins.meta.changes) return json({ ok: true, duplicate: true });

  try {
    if (type !== 'checkout_session.payment.paid') return json({ ok: true });
    const session = evt.data.attributes.data ?? {};
    const order = await env.DB.prepare(
      'SELECT o.id, o.status, o.customer_email, o.amount_centavos, i.id AS invitation_id, i.slug, d.name AS design_name FROM orders o JOIN invitations i ON i.id = o.product_id JOIN products_designs d ON d.id = i.design_id WHERE o.paymongo_checkout_id = ?',
    ).bind(String(session.id ?? '')).first<any>();
    if (!order) return json({ ok: true });
    await env.DB.prepare('UPDATE payment_events SET order_id = ? WHERE paymongo_event_id = ?').bind(order.id, eventId).run();
    if (order.status !== 'pending') return json({ ok: true });

    const paidAt = new Date();
    const [paid] = await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = ?, paymongo_payment_id = ? WHERE id = ? AND status = 'pending'")
        .bind(paidAt.toISOString(), session.attributes?.payments?.[0]?.id ?? null, order.id),
      env.DB.prepare("UPDATE invitations SET status = 'live' WHERE id = ? AND status = 'pending'").bind(order.invitation_id),
    ]);
    if (!paid.meta.changes) return json({ ok: true });

    const origin = new URL(request.url).origin;
    context.waitUntil((async () => {
      try {
        // The server keeps only hashes, so the email needs a fresh raw token. It replaces the
        // success-page token only once the email is sent; otherwise that token keeps working.
        const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
        if (!smtp?.enabled) return;
        const token = randomToken();
        await sendSmtpEmail(env.DB, smtp, {
          to: order.customer_email,
          subject: 'Your wedding invitation is live',
          // "Key: value" blocks: the HTML builder renders them as tables and keeps every URL (plain paragraphs keep only the first)
          body: [
            'Thank you! Your payment was received and your wedding invitation is now live. Share the guest link with your guests. Use the manage link to edit your invitation and see RSVPs, and keep it private.',
            '',
            `Guest link: ${origin}/i/${order.slug}`,
            `Manage link: ${origin}/manage#${token}`,
            '',
            `Design: ${order.design_name}`,
            `Amount paid: ${pesos(order.amount_centavos)}`,
            `Date: ${paidAt.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' })}`,
            `Order ID: ${order.id}`,
          ].join('\n'),
        }, request);
        await env.DB.prepare("UPDATE invitations SET manage_token_hash = ? WHERE id = ? AND status = 'live'").bind(await sha256(token), order.invitation_id).run();
      } catch (e) {
        console.error('Paid email failed:', e instanceof Error ? e.message : e);
      }
    })());
    return json({ ok: true });
  } catch (e) {
    // Forget the event so PayMongo's retry is processed instead of skipped as a duplicate
    console.error('PayMongo webhook error:', e instanceof Error ? e.message : e);
    await env.DB.prepare('DELETE FROM payment_events WHERE paymongo_event_id = ?').bind(eventId).run();
    return json({ error: 'Webhook processing failed.' }, 500);
  }
};
