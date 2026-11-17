// Promo code rules. Dependency-free: used by the Cloudflare server (every amount is computed there) and the React client.
export const MIN_TOTAL_CENTAVOS = 100; // the amount payable never drops below ₱1.00

export type PromoRow = {
  code: string; discount_type: string; discount_value: number; min_purchase_centavos: number;
  starts_at: string | null; expires_at: string | null; max_uses: number | null; active: number;
};
export type PromoReason = 'unknown' | 'inactive' | 'not_started' | 'expired' | 'used_up' | 'below_minimum';
export type PromoResult = { ok: true; discountCentavos: number; totalCentavos: number } | { ok: false; reason: PromoReason; error: string };

const pesos = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const normalizeCode = (s: unknown): string => (typeof s === 'string' ? s.trim().toUpperCase() : '');

export const MESSAGE = {
  unknown: 'We could not find that promo code.',
  inactive: 'This promo code is not active.',
  not_started: 'This promo code is not active yet.',
  expired: 'This promo code has expired.',
  used_up: 'This promo code has reached its limit.',
} as const;

export const promoLabel = (type: string, value: number) => (type === 'percent' ? `${value}% off` : `${pesos(value)} off`);

export function applyPromo(promo: PromoRow, priceCentavos: number, now: Date, usedCount: number): PromoResult {
  const no = (reason: PromoReason, error: string): PromoResult => ({ ok: false, reason, error });
  if (!promo.active) return no('inactive', MESSAGE.inactive);
  if (promo.starts_at && Date.parse(promo.starts_at) > now.getTime()) return no('not_started', MESSAGE.not_started);
  if (promo.expires_at && Date.parse(promo.expires_at) <= now.getTime()) return no('expired', MESSAGE.expired);
  if (promo.max_uses != null && usedCount >= promo.max_uses) return no('used_up', MESSAGE.used_up);
  if (priceCentavos < promo.min_purchase_centavos) return no('below_minimum', `This promo code needs a minimum purchase of ${pesos(promo.min_purchase_centavos)}.`);
  const raw = promo.discount_type === 'percent' ? Math.round(priceCentavos * promo.discount_value / 100) : promo.discount_value;
  const discountCentavos = Math.max(0, Math.min(raw, priceCentavos - MIN_TOTAL_CENTAVOS));
  return { ok: true, discountCentavos, totalCentavos: priceCentavos - discountCentavos };
}

export type PromoInput = {
  code: string; description: string; discountType: 'percent' | 'fixed'; discountValue: number;
  minPurchaseCentavos: number; startsAt: string | null; expiresAt: string | null; maxUses: number | null;
};

export function validatePromoInput(b: any): { ok: true; value: PromoInput } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  const code = normalizeCode(b?.code);
  if (!/^[A-Z0-9-]{3,30}$/.test(code)) return bad('The code must be 3 to 30 letters, numbers or dashes.');
  const description = b.description == null ? '' : b.description;
  if (typeof description !== 'string' || description.trim().length > 120) return bad('The description must be 120 characters or fewer.');
  const type = b.discountType;
  if (type !== 'percent' && type !== 'fixed') return bad('Choose a percent or fixed discount.');
  const v = b.discountValue;
  if (!Number.isInteger(v) || (type === 'percent' ? v < 1 || v > 100 : v < 100)) return bad(type === 'percent' ? 'A percent discount must be a whole number from 1 to 100.' : 'A fixed discount must be at least ₱1.');
  const min = b.minPurchaseCentavos ?? 0;
  if (!Number.isInteger(min) || min < 0) return bad('The minimum purchase cannot be negative.');
  const date = (x: unknown): string | null | undefined => {
    if (x == null || x === '') return null;
    const t = typeof x === 'string' ? Date.parse(x) : NaN;
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  };
  const startsAt = date(b.startsAt), expiresAt = date(b.expiresAt);
  if (startsAt === undefined || expiresAt === undefined) return bad('Dates must be valid.');
  if (startsAt && expiresAt && expiresAt <= startsAt) return bad('The end date must be after the start date.');
  const maxUses = b.maxUses ?? null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return bad('The use limit must be a whole number of 1 or more, or empty.');
  return { ok: true, value: { code, description: description.trim(), discountType: type, discountValue: v, minPurchaseCentavos: min, startsAt, expiresAt, maxUses } };
}
