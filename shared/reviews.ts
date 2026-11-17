// Review rules shared by the account API and the account form. No imports: node tests load this file.
export const REVIEW_MIN = 20;
export const REVIEW_MAX = 1000;
export const NAME_MAX = 60;

// Control characters out (tab and newline kept in the text only); line endings become \n.
export const cleanBody = (v: unknown) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
export const cleanName = (v: unknown) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

export function validateReview(b: any): { ok: true; value: { rating: number; body: string; displayName: string } } | { ok: false; error: string } {
  const rating = b?.rating, body = cleanBody(b?.body), displayName = cleanName(b?.displayName);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'Choose a rating from 1 to 5 stars.' };
  if (displayName.length < 1 || displayName.length > NAME_MAX) return { ok: false, error: `Enter a display name of up to ${NAME_MAX} characters.` };
  if (body.length < REVIEW_MIN || body.length > REVIEW_MAX) return { ok: false, error: `Write your review in ${REVIEW_MIN} to ${REVIEW_MAX} characters.` };
  return { ok: true, value: { rating, body, displayName } };
}

// One decimal; null when there are no ratings.
export const averageRating = (sum: number, count: number): number | null => (count > 0 ? Math.round((sum / count) * 10) / 10 : null);
