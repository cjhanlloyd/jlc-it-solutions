import { Bad, LIMITS, isoDate, obj, schedule, str, time, venue, type Result, type Venue } from '../invitation-fields.ts';
import type { Occasion } from './index.ts';

export type InvitationDetails = {
  partner1: string; partner2: string; eventDate: string; eventTime: string;
  ceremony: Venue; reception?: Venue;
  schedule: { time: string; label: string }[];
  dressCode?: string; message?: string; rsvpDeadline?: string; giftsNote?: string;
};
export type WeddingDetails = InvitationDetails;

export function validateDetails(input: unknown): Result<'details', InvitationDetails> {
  try {
    const i = obj(input, 'Details');
    const d: InvitationDetails = {
      partner1: str(i.partner1, 'Partner 1', LIMITS.name, true),
      partner2: str(i.partner2, 'Partner 2', LIMITS.name, true),
      eventDate: isoDate(i.eventDate, 'Event date', true),
      eventTime: time(i.eventTime, 'Event time'),
      ceremony: venue(i.ceremony, 'Ceremony', true),
      schedule: [],
    };
    // Optional venue counts as absent when it has no name.
    if (i.reception && str(obj(i.reception, 'Reception').name, 'Reception name', LIMITS.venueName)) d.reception = venue(i.reception, 'Reception', true);
    d.schedule = schedule(i.schedule);
    // Optional strings are omitted when empty.
    const opt = { dressCode: str(i.dressCode, 'Dress code', LIMITS.dressCode), message: str(i.message, 'Message', LIMITS.message), rsvpDeadline: isoDate(i.rsvpDeadline, 'RSVP deadline'), giftsNote: str(i.giftsNote, 'Gifts note', LIMITS.giftsNote) };
    for (const [k, v] of Object.entries(opt)) if (v) (d as Record<string, unknown>)[k] = v;
    return { ok: true, details: d };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

export const lockedFieldsChanged = (before: InvitationDetails, after: InvitationDetails): boolean =>
  before.partner1 !== after.partner1 || before.partner2 !== after.partner2;

export const wedding: Occasion<WeddingDetails> = {
  productType: 'wedding_invitation', label: 'Wedding', noun: 'wedding', dateNoun: 'wedding',
  layouts: ['classic', 'garden', 'modern'], askKids: false,
  validateDetails, lockedFieldsChanged,
  lockedMessage: 'Names cannot be changed after payment.',
  title: (d) => `${d.partner1} & ${d.partner2}`,
  slugBase: (d) => `${d.partner1} and ${d.partner2}`,
  expiredSummary: (d) => ({ partner1: d.partner1, partner2: d.partner2, _purged: true }),
};
