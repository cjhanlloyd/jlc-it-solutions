import type { Result } from '../invitation-fields.ts';
import type { Card } from './card.ts';
import { birthday } from './birthday.ts';
import { debut } from './debut.ts';
import { wedding } from './wedding.ts';

export type Occasion<D = any> = {
  productType: string; label: string; noun: string; dateNoun: string; // dateNoun: "The <dateNoun> date cannot be in the past."
  layouts: readonly string[]; askKids: boolean;
  validateDetails(input: unknown): Result<'details', D>;
  lockedFieldsChanged(before: D, after: D): boolean; lockedMessage: string;
  title(d: D): string;
  slugBase(d: D): string;
  expiredSummary(d: D): Record<string, unknown>; // fields title() needs + _purged: true
  card(d: Partial<D>): Card; // tolerates missing fields (drafts, purged details), giving ''
};

export const OCCASIONS: Record<string, Occasion> = { [wedding.productType]: wedding, [birthday.productType]: birthday, [debut.productType]: debut };
export const occasionOf = (productType: string | null | undefined): Occasion | null =>
  (productType && Object.prototype.hasOwnProperty.call(OCCASIONS, productType) ? OCCASIONS[productType] : null);
export const LAYOUT_KEYS: readonly string[] = [...new Set(Object.values(OCCASIONS).flatMap((o) => o.layouts))];

// Layouts receive details but not the product type; each occasion's name field tells them apart.
export const occasionForDetails = (d: object): Occasion => ('debutante' in d ? debut : 'celebrant' in d ? birthday : wedding);
