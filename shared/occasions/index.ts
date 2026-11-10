import type { Result } from '../invitation-fields.ts';
import { birthday } from './birthday.ts';
import { wedding } from './wedding.ts';

export type Occasion<D = any> = {
  productType: string; label: string; noun: string;
  layouts: readonly string[]; askKids: boolean;
  validateDetails(input: unknown): Result<'details', D>;
  lockedFieldsChanged(before: D, after: D): boolean; lockedMessage: string;
  title(d: D): string;
  slugBase(d: D): string;
  expiredSummary(d: D): Record<string, unknown>; // fields title() needs + _purged: true
};

export const OCCASIONS: Record<string, Occasion> = { [wedding.productType]: wedding, [birthday.productType]: birthday };
export const occasionOf = (productType: string | null | undefined): Occasion | null =>
  (productType && Object.hasOwn(OCCASIONS, productType) ? OCCASIONS[productType] : null);
export const LAYOUT_KEYS: readonly string[] = Object.values(OCCASIONS).flatMap((o) => o.layouts);
