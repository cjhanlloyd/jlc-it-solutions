/// <reference types="@cloudflare/workers-types" />
import { manualGcash } from './manual-gcash';
import { paymongo } from './paymongo';

export { paymentInstructions } from './manual-gcash';

export type PaymentSettings = { provider: string; gcashAccountName: string; gcashNumber: string; instructions: string; qrKey: string | null; deadlineHours: number };
export type PaymentStart = { kind: 'instructions'; provider: 'manual_gcash' } | { kind: 'redirect'; provider: 'paymongo'; url: string; providerRef: string };
export interface PaymentProvider {
  key: string;
  /** null = ready, else the reason it is not */
  ready(s: PaymentSettings): string | null;
  start(order: { id: number; reference: string; amountCentavos: number; email: string; itemName: string }, ctx: { env: any; origin: string }): Promise<PaymentStart>;
}

export async function loadPaymentSettings(db: D1Database): Promise<PaymentSettings> {
  const r = await db.prepare("SELECT * FROM payment_settings WHERE id = 'default'").first<any>();
  return {
    provider: r?.provider ?? 'manual_gcash', gcashAccountName: r?.gcash_account_name ?? '', gcashNumber: r?.gcash_number ?? '',
    instructions: r?.instructions ?? '', qrKey: r?.qr_key ?? null, deadlineHours: r?.deadline_hours ?? 48,
  };
}

export const activeProvider = (s: PaymentSettings): PaymentProvider => (s.provider === 'paymongo' ? paymongo : manualGcash);
