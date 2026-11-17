/// <reference types="@cloudflare/workers-types" />
// Customer emails for QR payment orders. Fire-and-forget: never throws, no-op when SMTP is disabled.
import { CUSTOMER_MESSAGE, STATUS_LABEL, type OrderStatus } from '../shared/order-status';
import { sendSmtpEmail } from './email';
import { occasionOf } from '../shared/occasions';
import { tierOf } from '../shared/tiers';
import { emailAndRotateToken } from './invitation-links';

// 'review' and 'new_order' go to the team (new_order: the alert address, else the sender address); every other kind to the customer
export type NotifyKind = 'placed' | 'receipt' | 'confirmed' | 'rejected' | 'delivered' | 'cancelled' | 'refunded' | 'proof' | 'review' | 'new_order';

const pesos = (centavos: number) => `PHP ${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const manila = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });

const INTRO: Record<NotifyKind, [subject: string, message: string]> = {
  placed: ['Your order is placed', 'Thank you for your order! Please scan our payment QR code with your preferred payment app before the deadline and upload your receipt on your order page.'],
  receipt: ['We received your payment receipt', CUSTOMER_MESSAGE.payment_verification],
  confirmed: ['Your payment is confirmed', CUSTOMER_MESSAGE.payment_confirmed],
  rejected: ['We could not confirm your payment', 'We could not confirm your payment. Please check the reason below and upload a new receipt on your order page.'],
  delivered: ['Your invitation is live', 'Your invitation is now live. Share the guest link with your guests. Use the manage link to edit your invitation and see RSVPs, and keep it private. You can also sign in to My account with this email to manage your invitations and guest links.'],
  cancelled: ['Your order was cancelled', CUSTOMER_MESSAGE.cancelled],
  refunded: ['Your order was refunded', CUSTOMER_MESSAGE.refunded],
  proof: ['Your design proof is ready', 'Your design proof is ready. Open your order page to review it, then approve it or request changes.'],
  review: ['Customer reviewed a proof', 'A customer reviewed their design proof.'],
  new_order: ['New order', 'A new order was placed.'],
};
const CONFIRMED_CUSTOM = "Your payment is confirmed. Our designer will start on your invitation now, and you'll receive a proof to review.";

export async function notify(db: D1Database, request: Request, orderId: number, kind: NotifyKind, extra: { trackingToken?: string; reason?: string; decision?: string; note?: string } = {}): Promise<void> {
  try {
    const smtp: any = await db.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
    if (!smtp?.enabled) return;
    const o = await db.prepare(
      'SELECT o.id, o.reference, o.status, o.package_kind, o.customer_email, o.amount_centavos, o.package_name, o.payment_deadline, o.product_id AS invitation_id, i.slug, d.name AS design_name, d.product_type, i.tier, o.created_at, o.promo_code, o.discount_centavos, c.name AS customer_name FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?',
    ).bind(orderId).first<any>();
    if (!o) return;
    const origin = new URL(request.url).origin;
    const orderLink = `${origin}/order/${o.reference}${kind === 'placed' && extra.trackingToken ? `#${extra.trackingToken}` : ''}`;
    const [subject, intro] = INTRO[kind];
    const message = kind === 'confirmed' && o.package_kind === 'custom' ? CONFIRMED_CUSTOM : intro;
    // "Key: value" lines: the HTML builder renders them as a table and keeps every URL
    const lines = [
      `Order reference: ${o.reference}`,
      `Status: ${STATUS_LABEL[o.status as OrderStatus] ?? o.status}`,
      o.design_name && `Design: ${o.design_name}`,
      `Package: ${o.package_name ?? 'Standard'}`,
      o.promo_code && `Promo code: ${o.promo_code}`,
      o.promo_code && `Discount: ${pesos(o.discount_centavos)}`,
      `Amount: ${pesos(o.amount_centavos)}`,
      kind === 'placed' && o.payment_deadline && `Pay by: ${manila(o.payment_deadline)}`,
      `Order page: ${orderLink}`,
      // "Key: value" so the HTML email keeps the URL (a plain paragraph drops it)
      `My account: ${origin}/account (sign in with this email)`,
    ];
    if (kind === 'rejected') {
      const reason = extra.reason ?? (await db.prepare("SELECT note FROM payments WHERE order_id = ? AND status = 'rejected' ORDER BY id DESC LIMIT 1").bind(orderId).first<any>())?.note;
      if (reason) lines.splice(2, 0, `Reason: ${reason}`);
    }
    const body = (head: string[]) => [message, '', ...head, ...lines.filter(Boolean)].join('\n');
    const mail = { to: o.customer_email, subject: `${subject} (${o.reference})` };

    if (kind === 'new_order') {
      // Single call site (checkout), and sendSmtpEmail does not log to sent_emails, so there is no duplicate guard
      const discount = o.promo_code ? o.discount_centavos : 0;
      const team = [
        `Order reference: ${o.reference}`,
        `Customer name: ${o.customer_name ?? 'Not given'}`,
        `Customer email: ${o.customer_email}`,
        `Occasion: ${occasionOf(o.product_type)?.label ?? 'Not set'}`,
        o.design_name && `Design: ${o.design_name}`,
        `Package: ${o.package_name ?? 'Standard'}${tierOf(o) === 'premium' ? ' (Premium)' : ''}`,
        `Order date: ${manila(o.created_at.includes('T') ? o.created_at : `${o.created_at.replace(' ', 'T')}Z`)}`,
        `Subtotal: ${pesos(o.amount_centavos + discount)}`,
        o.promo_code && `Promo code: ${o.promo_code}`,
        o.promo_code && `Discount: ${pesos(discount)}`,
        `Total: ${pesos(o.amount_centavos)}`,
        `Payment status: ${o.status === 'pending_payment' ? 'Awaiting payment' : STATUS_LABEL[o.status as OrderStatus] ?? o.status}`,
        `Order status: ${STATUS_LABEL[o.status as OrderStatus] ?? o.status}`,
        `Open in admin: ${origin}/admin#/orders/${o.id}`,
      ];
      const to = String(smtp.order_alert_email ?? '').trim() || smtp.senderEmail;
      try {
        await sendSmtpEmail(db, smtp, { to, subject: `${subject} ${o.reference} — ${pesos(o.amount_centavos)}`, body: [message, '', ...team.filter(Boolean)].join('\n') }, request);
      } catch (e) {
        console.error(`New-order alert for order ${orderId} failed:`, e instanceof Error ? e.message : e);
      }
    } else if (kind === 'review') {
      // To the team; the customer's order page link would be useless without their token
      const team = [
        `Decision: ${extra.decision === 'approve' ? 'Approved' : 'Requested changes'}`,
        extra.note && `Note: ${extra.note}`,
        `Order reference: ${o.reference}`,
        `Status: ${STATUS_LABEL[o.status as OrderStatus] ?? o.status}`,
        o.design_name && `Design: ${o.design_name}`,
        `Admin order: ${origin}/admin#/orders/${o.id}`,
      ];
      await sendSmtpEmail(db, smtp, { to: smtp.senderEmail, subject: `${subject} (${o.reference})`, body: [message, '', ...team.filter(Boolean)].join('\n') }, request);
    } else if (kind === 'delivered') {
      const proof = o.package_kind === 'custom' ? await db.prepare('SELECT kind, url FROM order_proofs WHERE order_id = ? ORDER BY round DESC LIMIT 1').bind(orderId).first<any>() : null;
      const approved = proof && `Approved design: ${proof.kind === 'link' ? proof.url : 'view it on your order page'}`;
      await emailAndRotateToken(db, smtp, request, o.invitation_id, (token) => ({
        ...mail, body: body([...(approved ? [approved] : []), `Guest link: ${origin}/i/${o.slug}`, `Manage link: ${origin}/manage#${token}`]),
      }));
    } else {
      await sendSmtpEmail(db, smtp, { ...mail, body: body([]) }, request);
    }
  } catch (e) {
    console.error(`Order email '${kind}' for order ${orderId} failed:`, e instanceof Error ? e.message : e);
  }
}
