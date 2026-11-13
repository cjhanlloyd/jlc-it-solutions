/// <reference types="@cloudflare/workers-types" />
// Customer emails for GCash orders. Fire-and-forget: never throws, no-op when SMTP is disabled.
import { CUSTOMER_MESSAGE, STATUS_LABEL, type OrderStatus } from '../shared/order-status';
import { sendSmtpEmail } from './email';
import { emailAndRotateToken } from './invitation-links';

export type NotifyKind = 'placed' | 'receipt' | 'confirmed' | 'rejected' | 'delivered' | 'cancelled' | 'refunded';

const pesos = (centavos: number) => `PHP ${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const manila = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });

const INTRO: Record<NotifyKind, [subject: string, message: string]> = {
  placed: ['Your order is placed', 'Thank you for your order! Please pay with GCash before the deadline and upload your receipt on your order page.'],
  receipt: ['We received your GCash receipt', CUSTOMER_MESSAGE.payment_verification],
  confirmed: ['Your GCash payment is confirmed', CUSTOMER_MESSAGE.payment_confirmed],
  rejected: ['We could not confirm your GCash payment', 'We could not confirm your GCash payment. Please check the reason below and upload a new receipt on your order page.'],
  delivered: ['Your invitation is live', 'Your invitation is now live. Share the guest link with your guests. Use the manage link to edit your invitation and see RSVPs, and keep it private.'],
  cancelled: ['Your order was cancelled', CUSTOMER_MESSAGE.cancelled],
  refunded: ['Your order was refunded', CUSTOMER_MESSAGE.refunded],
};

export async function notify(db: D1Database, request: Request, orderId: number, kind: NotifyKind, extra: { trackingToken?: string; reason?: string } = {}): Promise<void> {
  try {
    const smtp: any = await db.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
    if (!smtp?.enabled) return;
    const o = await db.prepare(
      'SELECT o.id, o.reference, o.status, o.customer_email, o.amount_centavos, o.payment_deadline, o.product_id AS invitation_id, i.slug, d.name AS design_name FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id WHERE o.id = ?',
    ).bind(orderId).first<any>();
    if (!o) return;
    const origin = new URL(request.url).origin;
    const orderLink = `${origin}/order/${o.reference}${kind === 'placed' && extra.trackingToken ? `#${extra.trackingToken}` : ''}`;
    const [subject, message] = INTRO[kind];
    // "Key: value" lines: the HTML builder renders them as a table and keeps every URL
    const lines = [
      `Order reference: ${o.reference}`,
      `Status: ${STATUS_LABEL[o.status as OrderStatus] ?? o.status}`,
      o.design_name && `Design: ${o.design_name}`,
      `Amount: ${pesos(o.amount_centavos)}`,
      kind === 'placed' && o.payment_deadline && `Pay by: ${manila(o.payment_deadline)}`,
      `Order page: ${orderLink}`,
    ];
    if (kind === 'rejected') {
      const reason = extra.reason ?? (await db.prepare("SELECT note FROM payments WHERE order_id = ? AND status = 'rejected' ORDER BY id DESC LIMIT 1").bind(orderId).first<any>())?.note;
      if (reason) lines.splice(2, 0, `Reason: ${reason}`);
    }
    const body = (head: string[]) => [message, '', ...head, ...lines.filter(Boolean)].join('\n');
    const mail = { to: o.customer_email, subject: `${subject} (${o.reference})` };

    if (kind === 'delivered') {
      await emailAndRotateToken(db, smtp, request, o.invitation_id, (token) => ({
        ...mail, body: body([`Guest link: ${origin}/i/${o.slug}`, `Manage link: ${origin}/manage#${token}`]),
      }));
    } else {
      await sendSmtpEmail(db, smtp, { ...mail, body: body([]) }, request);
    }
  } catch (e) {
    console.error(`Order email '${kind}' for order ${orderId} failed:`, e instanceof Error ? e.message : e);
  }
}
