import { createCheckoutSession } from '../paymongo';
import type { PaymentProvider } from './index';

export { createCheckoutSession, verifyPaymongoSignature } from '../paymongo';

// Disabled in the customer flow: activeProvider only returns it when settings.provider is 'paymongo'.
export const paymongo: PaymentProvider = {
  key: 'paymongo',
  ready: () => null, // needs PAYMONGO_SECRET_KEY; checked in start() where env is available
  async start(order, { env, origin }) {
    if (!env.PAYMONGO_SECRET_KEY) throw new Error('PayMongo is not configured.');
    const s = await createCheckoutSession(env.PAYMONGO_SECRET_KEY, {
      amountCentavos: order.amountCentavos, itemName: order.itemName, referenceNumber: order.reference,
      successUrl: `${origin}/order/${order.reference}`, cancelUrl: `${origin}/order/${order.reference}`,
      customerEmail: order.email, metadata: { order_id: String(order.id) },
    });
    return { kind: 'redirect', provider: 'paymongo', url: s.checkoutUrl, providerRef: s.id };
  },
};
