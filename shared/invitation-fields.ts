// Field rules shared by the Pages Functions and the React frontend. Keep this file dependency-free.
export const LIMITS = {
  name: 60, venueName: 120, address: 200, mapUrl: 500, dressCode: 200, message: 1000, giftsNote: 300,
  scheduleItems: 8, scheduleLabel: 80, photos: 6, photoChars: 1_400_000,
  rsvpName: 80, rsvpMessage: 500, partySizeMax: 10,
} as const;

export const LAYOUT_KEYS = ['classic', 'garden', 'modern'] as const;

export type Venue = { name: string; address: string; mapUrl: string };
export type InvitationDetails = {
  partner1: string; partner2: string; eventDate: string; eventTime: string;
  ceremony: Venue; reception?: Venue;
  schedule: { time: string; label: string }[];
  dressCode?: string; message?: string; rsvpDeadline?: string; giftsNote?: string;
};
type Result<K extends string, T> = ({ ok: true } & Record<K, T>) | { ok: false; error: string };

class Bad extends Error {}
const fail = (m: string): never => { throw new Bad(m); };

// Returns the trimmed string; '' when absent and not required.
function str(v: unknown, label: string, max: number, required = false): string {
  if (v == null || v === '') return required ? fail(`${label} is required`) : '';
  if (typeof v !== 'string') return fail(`${label} must be text`);
  const s = v.trim();
  if (!s && required) return fail(`${label} is required`);
  if (s.length > max) return fail(`${label} is too long (max ${max})`);
  return s;
}

function isoDate(v: unknown, label: string, required = false): string {
  const s = str(v, label, 10, required);
  if (!s) return s;
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) fail(`${label} must be a valid date`);
  return s;
}

const time = (v: unknown, label: string, required = false): string => {
  const s = str(v, label, 5, required);
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${label} must be HH:MM`);
  return s;
};

const obj = (v: unknown, label: string): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${label} must be an object`);

function venue(v: unknown, label: string, required: boolean): Venue {
  const o = obj(v, label);
  let mapUrl = str(o.mapUrl, `${label} map link`, LIMITS.mapUrl);
  if (mapUrl) {
    // Couples paste links without a scheme (maps.app.goo.gl/…) or with http://; complete them to https://
    const scheme = mapUrl.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
    if (!scheme) mapUrl = 'https://' + mapUrl;
    else if (/^https?$/i.test(scheme)) mapUrl = 'https:' + mapUrl.slice(scheme.length + 1);
    if (!/^https:\/\/[^\s/]+\.[^\s/]+\S*$/.test(mapUrl)) fail(`${label} map link must be a web link, like https://maps.app.goo.gl/…`);
  }
  return { name: str(o.name, `${label} name`, LIMITS.venueName, required), address: str(o.address, `${label} address`, LIMITS.address), mapUrl };
}

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
    const sched = i.schedule ?? [];
    if (!Array.isArray(sched)) fail('Schedule must be a list');
    if ((sched as unknown[]).length > LIMITS.scheduleItems) fail(`Schedule has too many items (max ${LIMITS.scheduleItems})`);
    d.schedule = (sched as unknown[]).map((s) => {
      const o = obj(s, 'Schedule item');
      return { time: time(o.time, 'Schedule time', true), label: str(o.label, 'Schedule label', LIMITS.scheduleLabel, true) };
    });
    // Optional strings are omitted when empty.
    const opt = { dressCode: str(i.dressCode, 'Dress code', LIMITS.dressCode), message: str(i.message, 'Message', LIMITS.message), rsvpDeadline: isoDate(i.rsvpDeadline, 'RSVP deadline'), giftsNote: str(i.giftsNote, 'Gifts note', LIMITS.giftsNote) };
    for (const [k, v] of Object.entries(opt)) if (v) (d as Record<string, unknown>)[k] = v;
    return { ok: true, details: d };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

export function validateRsvp(input: unknown): Result<'rsvp', { guestName: string; attending: boolean; partySize: number; message: string }> {
  try {
    const i = obj(input, 'RSVP');
    if (typeof i.attending !== 'boolean') fail('Attending must be yes or no');
    const n = i.partySize;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > LIMITS.partySizeMax) fail(`Party size must be 1 to ${LIMITS.partySizeMax}`);
    return { ok: true, rsvp: { guestName: str(i.guestName, 'Name', LIMITS.rsvpName, true), attending: i.attending as boolean, partySize: n as number, message: str(i.message, 'Message', LIMITS.rsvpMessage) } };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

export const lockedFieldsChanged = (before: InvitationDetails, after: InvitationDetails): boolean =>
  before.partner1 !== after.partner1 || before.partner2 !== after.partner2;

export function makeSlug(p1: string, p2: string, random: string): string {
  const base = `${p1} and ${p2}`.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return `${base}-${random}`;
}
