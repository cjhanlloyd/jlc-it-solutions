import type React from 'react';
import { DetailsForm, checkDraft, previewDetails, toDraft } from './WeddingForm';
import { BirthdayForm } from './BirthdayForm';
import { checkBirthdayDraft, previewBirthday, toBirthdayDraft } from './birthday-draft';

export type OccasionForm<Draft = any> = {
  toDraft(d?: any): Draft; // every field as a string, like the wedding Draft
  check(d: Draft): { ok: true; details: any } | { ok: false; error: string };
  preview(d: Draft, fallback: Draft): any; // fills half-typed required fields from the sample/saved details
  Form: React.ComponentType<{ draft: Draft; onChange: (d: Draft) => void; lockNames?: boolean }>;
};

export const FORMS: Record<string, OccasionForm> = {
  wedding_invitation: { toDraft, check: (d) => checkDraft(d) as any, preview: previewDetails, Form: DetailsForm },
  birthday_invitation: { toDraft: toBirthdayDraft, check: checkBirthdayDraft, preview: previewBirthday, Form: BirthdayForm },
};

export const formOf = (productType: string | null | undefined): OccasionForm | null =>
  (productType && Object.hasOwn(FORMS, productType) ? FORMS[productType] : null);
