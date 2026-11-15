import type { PaymentProvider, PaymentSettings } from './index';

export const manualGcash: PaymentProvider = {
  key: 'manual_gcash',
  ready: (s) => (s.gcashAccountName && s.gcashNumber && s.qrKey ? null : 'GCash payment details are not set up yet.'),
  async start() { return { kind: 'instructions', provider: 'manual_gcash' }; },
};

export function paymentInstructions(s: PaymentSettings, order: { reference: string; amountCentavos: number; paymentDeadline: string | null }) {
  return {
    method: 'GCash' as const, accountName: s.gcashAccountName, accountNumber: s.gcashNumber, instructions: s.instructions,
    qrUrl: '/api/orders/gcash-qr', amountCentavos: order.amountCentavos, reference: order.reference, deadline: order.paymentDeadline,
  };
}
