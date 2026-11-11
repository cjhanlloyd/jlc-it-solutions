import { Bad, LIMITS, fail, isoDate, obj, schedule, str, time, venue, type Result, type Venue } from '../invitation-fields.ts';
import type { Occasion } from './index.ts';

// The named debut traditions; each is optional and holds up to 18 names.
export const TRADITIONS = [
  { key: 'roses', label: '18 Roses' },
  { key: 'candles', label: '18 Candles' },
  { key: 'treasures', label: '18 Treasures' },
] as const;
export type TraditionKey = (typeof TRADITIONS)[number]['key'];

export type DebutDetails = {
  debutante: string; eventDate: string; eventTime: string;
  venue: Venue;
  schedule: { time: string; label: string }[];
  headline?: string; theme?: string; hostedBy?: string; escort?: string;
  dressCode?: string; giftsNote?: string; message?: string; rsvpDeadline?: string;
} & Partial<Record<TraditionKey, string[]>>;

function names(v: unknown, label: string): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`${label} must be a list of names`);
  const out = (v as unknown[]).map((n, i) => str(n, `${label} name ${i + 1}`, LIMITS.name)).filter(Boolean);
  if (out.length > LIMITS.traditionNames) fail(`${label} can list at most ${LIMITS.traditionNames} names`);
  return out;
}

function validateDetails(input: unknown): Result<'details', DebutDetails> {
  try {
    const i = obj(input, 'Details');
    const d: DebutDetails = {
      debutante: str(i.debutante, "Debutante's name", LIMITS.name, true),
      eventDate: isoDate(i.eventDate, 'Event date', true),
      eventTime: time(i.eventTime, 'Event time'),
      venue: venue(i.venue, 'Venue', true),
      schedule: schedule(i.schedule),
    };
    for (const t of TRADITIONS) {
      const list = names(i[t.key], t.label);
      if (list.length) d[t.key] = list;
    }
    // Optional strings are omitted when empty.
    const opt = {
      headline: str(i.headline, 'Headline', LIMITS.headline), theme: str(i.theme, 'Theme', LIMITS.theme), hostedBy: str(i.hostedBy, 'Hosted by', LIMITS.hostedBy),
      escort: str(i.escort, 'Escort', LIMITS.name),
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

export const debut: Occasion<DebutDetails> = {
  productType: 'debut_invitation', label: 'Debut', noun: 'debut', dateNoun: 'debut',
  layouts: ['blush'], askKids: false,
  validateDetails,
  lockedFieldsChanged: (a, b) => a.debutante !== b.debutante,
  lockedMessage: "The debutante's name cannot be changed after payment.",
  title: (d) => `${d.debutante}'s Debut`,
  slugBase: (d) => `${d.debutante} debut`,
  expiredSummary: (d) => ({ debutante: d.debutante, _purged: true }),
};
