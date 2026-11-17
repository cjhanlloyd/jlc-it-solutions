// Pure helpers for the promo codes page: Manila (UTC+8, no DST) form dates <-> UTC ISO, status and validity text.
const MANILA_MS = 8 * 3600_000;

/** Manila date "YYYY-MM-DD" and optional time "HH:MM" -> UTC ISO. A blank time means 00:00, or 23:59:59 for an expiry. Blank/invalid date -> null. */
export function manilaToIso(date: string, time: string, endOfDay = false): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!d) return null;
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  const [h, m, s] = t ? [Number(t[1]), Number(t[2]), 0] : endOfDay ? [23, 59, 59] : [0, 0, 0];
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m, s) - MANILA_MS;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** UTC ISO -> Manila form fields. 23:59:59 comes back as a blank time ("end of that day") so a re-save keeps it. */
export function isoToManila(iso: string | null | undefined): { date: string; time: string } {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return { date: '', time: '' };
  const s = new Date(ms + MANILA_MS).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 19) === '23:59:59' ? '' : s.slice(11, 16) };
}

export type PromoStatus = 'Active' | 'Inactive' | 'Expired' | 'Scheduled' | 'Used up';
type StatusInput = { active: boolean; startsAt: string | null; expiresAt: string | null; maxUses: number | null; uses: number };

export function promoStatus(p: StatusInput, now: Date): PromoStatus {
  if (!p.active) return 'Inactive';
  if (p.expiresAt && Date.parse(p.expiresAt) <= now.getTime()) return 'Expired';
  if (p.startsAt && Date.parse(p.startsAt) > now.getTime()) return 'Scheduled';
  if (p.maxUses != null && p.uses >= p.maxUses) return 'Used up';
  return 'Active';
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });

export function validityText(startsAt: string | null, expiresAt: string | null): string {
  if (startsAt && expiresAt) return `${day(startsAt)} to ${day(expiresAt)}`;
  if (expiresAt) return `Until ${day(expiresAt)}`;
  if (startsAt) return `From ${day(startsAt)}`;
  return 'No end date';
}

/** Whole pesos or pesos with centavos: 20000 -> "₱200", 12550 -> "₱125.50". */
export const pesoText = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: centavos % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
