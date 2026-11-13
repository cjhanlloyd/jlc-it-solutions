// Order lifecycle rules. Dependency-free: used by the Cloudflare server and the React client.
export type OrderStatus =
  | 'pending_payment' | 'payment_verification' | 'payment_confirmed' | 'in_production'
  | 'for_review' | 'revision_requested' | 'completed' | 'delivered' | 'cancelled' | 'refunded';

export const STATUSES: readonly OrderStatus[] = [
  'pending_payment', 'payment_verification', 'payment_confirmed', 'in_production',
  'for_review', 'revision_requested', 'completed', 'delivered', 'cancelled', 'refunded',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  payment_verification: 'Payment Verification',
  payment_confirmed: 'Payment Confirmed',
  in_production: 'In Production',
  for_review: 'For Review',
  revision_requested: 'Revision Requested',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const CUSTOMER_MESSAGE: Record<OrderStatus, string> = {
  pending_payment: 'Please pay with GCash and upload your receipt to confirm your order.',
  payment_verification: 'We received your GCash receipt and are checking your payment.',
  payment_confirmed: 'Your GCash payment is confirmed and your order is queued for production.',
  in_production: 'We are now working on your order.',
  for_review: "Your payment is confirmed. We're doing a final check before your invitation goes live.",
  revision_requested: 'We received your revision request and are working on the changes.',
  completed: 'Your order is complete.',
  delivered: 'Your order has been delivered. Thank you!',
  cancelled: 'This order was cancelled.',
  refunded: 'Your payment for this order has been refunded.',
};

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['payment_verification', 'cancelled'],
  payment_verification: ['payment_confirmed', 'pending_payment', 'cancelled'],
  payment_confirmed: ['in_production', 'for_review', 'refunded'],
  in_production: ['for_review', 'refunded'],
  for_review: ['revision_requested', 'in_production', 'completed', 'delivered', 'refunded'],
  revision_requested: ['in_production', 'for_review', 'refunded'],
  completed: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: string, to: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(NEXT, from)) return false;
  return (NEXT[from as OrderStatus] as readonly string[]).includes(to);
}

export function isFinal(s: string): boolean {
  return s === 'cancelled' || s === 'refunded';
}

// Counted as revenue; refunded is not.
export const PAID_STATUSES: readonly OrderStatus[] = [
  'payment_confirmed', 'in_production', 'for_review', 'revision_requested', 'completed', 'delivered',
];
