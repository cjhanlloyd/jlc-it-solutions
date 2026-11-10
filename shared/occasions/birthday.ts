import { Bad, LIMITS, isoDate, obj, schedule, str, time, venue, type Result, type Venue } from '../invitation-fields.ts';
import type { Occasion } from './index.ts';

export type BirthdayDetails = {
  celebrant: string; age?: number; eventDate: string; eventTime: string;
  venue: Venue;
  schedule: { time: string; label: string }[];
  headline?: string; theme?: string; hostedBy?: string;
  dressCode?: string; giftsNote?: string; message?: string; rsvpDeadline?: string;
};

function validateDetails(input: unknown): Result<'details', BirthdayDetails> {
  try {
    const i = obj(input, 'Details');
    const d: BirthdayDetails = {
      celebrant: str(i.celebrant, 'Celebrant name', LIMITS.name, true),
      eventDate: isoDate(i.eventDate, 'Event date', true),
      eventTime: time(i.eventTime, 'Event time'),
      venue: venue(i.venue, 'Venue', true),
      schedule: schedule(i.schedule),
    };
    if (i.age != null && i.age !== '') {
      const a = i.age;
      if (typeof a !== 'number' || !Number.isInteger(a) || a < 1 || a > LIMITS.ageMax) fail('Age must be a whole number from 1 to ' + LIMITS.ageMax);
      d.age = a as number;
    }
    // Optional strings are omitted when empty.
    const opt = {
      headline: str(i.headline, 'Headline', LIMITS.headline), theme: str(i.theme, 'Theme', LIMITS.theme), hostedBy: str(i.hostedBy, 'Hosted by', LIMITS.hostedBy),
      dressCode: str(i.dressCode, 'Dress code', LIMITS.dressCode), giftsNote: str(i.giftsNote, 'Gifts note', LIMITS.giftsNote),
      message: str(i.message, 'Message', LIMITS.message), rsvpDeadline: isoDate(i.rsvpDeadline, 'RSVP deadline'),
    };
    for (const [k, v] of Object.entries(opt)) if (v) (d as Record<string, unknown>)[k] = v;
    return { ok: true, details: d };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

function fail(m: string): never { throw new Bad(m); }

export const ordinal = (n: number): string => {
  const r = n % 100;
  return n + (r >= 11 && r <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
};

export const birthday: Occasion<BirthdayDetails> = {
  productType: 'birthday_invitation', label: 'Birthday', noun: 'birthday', dateNoun: 'party',
  layouts: ['confetti', 'golden'], askKids: true,
  validateDetails,
  lockedFieldsChanged: (a, b) => a.celebrant !== b.celebrant,
  lockedMessage: "The celebrant's name cannot be changed after payment.",
  title: (d) => (d.age ? `${d.celebrant}'s ${ordinal(d.age)} Birthday` : `${d.celebrant}'s Birthday`),
  slugBase: (d) => (d.age ? `${d.celebrant} ${ordinal(d.age)} birthday` : `${d.celebrant} birthday`),
  expiredSummary: (d) => ({ celebrant: d.celebrant, ...(d.age ? { age: d.age } : {}), _purged: true }),
};
