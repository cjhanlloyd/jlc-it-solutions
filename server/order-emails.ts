/// <reference types="@cloudflare/workers-types" />
// Customer emails for QR payment orders. Fire-and-forget: never throws, no-op when SMTP is disabled.
import { CUSTOMER_MESSAGE, STATUS_LABEL, type OrderStatus } from '../shared/order-status';
import { sendSmtpEmail } from './email';
import { emailAndRotateToken } from './invitation-links';

// 'review' goes to the team (the SMTP sender address); every other kind to the customer
export type NotifyKind = 'placed' | 'receipt' | 'confirmed' | 'rejected' | 'delivered' | 'cancelled' | 'refunded' | 'proof' | 'review';

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
};
const CONFIRMED_CUSTOM = "Your payment is confirmed. Our designer will start on your invitation now, and you'll receive a proof to review.";

export async function notify(db: D1Database, request: Request, orderId: number, kind: NotifyKind, extra: { trackingToken?: string; reason?: string; decision?: string; note?: string } = {}): Promise<void> {
  try {
    const smtp: any = await db.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
    if (!smtp?.enabled) return;
    const o = await db.prepare(
      'SELECT o.id, o.reference, o.status, o.package_kind, o.customer_email, o.amount_centavos, o.package_name, o.payment_deadline, o.product_id AS invitation_id, i.slug, d.name AS design_name FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id WHERE o.id = ?',
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

    if (kind === 'review') {
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
