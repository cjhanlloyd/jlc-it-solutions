// Field helpers shared by the Pages Functions and the React frontend. Keep this file dependency-free.
// Per-occasion rules live in shared/occasions/.
export const LIMITS = {
  name: 60, venueName: 120, address: 200, mapUrl: 500, dressCode: 200, message: 1000, giftsNote: 300,
  scheduleItems: 8, scheduleLabel: 80, photos: 6, photoChars: 1_400_000,
  rsvpName: 80, rsvpMessage: 500, partySizeMax: 10,
  headline: 120, theme: 80, hostedBy: 120, ageMax: 120, kidsMax: 10, traditionNames: 18,
} as const;

export type Venue = { name: string; address: string; mapUrl: string };
export type Result<K extends string, T> = ({ ok: true } & Record<K, T>) | { ok: false; error: string };

export class Bad extends Error {}
export const fail = (m: string): never => { throw new Bad(m); };

// Returns the trimmed string; '' when absent and not required.
export function str(v: unknown, label: string, max: number, required = false): string {
  if (v == null || v === '') return required ? fail(`${label} is required`) : '';
  if (typeof v !== 'string') return fail(`${label} must be text`);
  const s = v.trim();
  if (!s && required) return fail(`${label} is required`);
  if (s.length > max) return fail(`${label} is too long (max ${max})`);
  return s;
}

export function isoDate(v: unknown, label: string, required = false): string {
  const s = str(v, label, 10, required);
  if (!s) return s;
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) fail(`${label} must be a valid date`);
  return s;
}

export const time = (v: unknown, label: string, required = false): string => {
  const s = str(v, label, 5, required);
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${label} must be HH:MM`);
  return s;
};

export const obj = (v: unknown, label: string): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${label} must be an object`);

export function venue(v: unknown, label: string, required: boolean): Venue {
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

export function schedule(input: unknown): { time: string; label: string }[] {
  const sched = input ?? [];
  if (!Array.isArray(sched)) fail('Schedule must be a list');
  if ((sched as unknown[]).length > LIMITS.scheduleItems) fail(`Schedule has too many items (max ${LIMITS.scheduleItems})`);
  return (sched as unknown[]).map((s) => {
    const o = obj(s, 'Schedule item');
    return { time: time(o.time, 'Schedule time', true), label: str(o.label, 'Schedule label', LIMITS.scheduleLabel, true) };
  });
}

export function validateRsvp(input: unknown, opts: { askKids?: boolean } = {}): Result<'rsvp', { guestName: string; attending: boolean; partySize: number; kidsCount: number; message: string }> {
  try {
    const i = obj(input, 'RSVP');
    if (typeof i.attending !== 'boolean') fail('Attending must be yes or no');
    const attending = i.attending as boolean;
    const n = i.partySize;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > LIMITS.partySizeMax) fail(`Party size must be 1 to ${LIMITS.partySizeMax}`);
    const k = i.kidsCount;
    const askKids = !!opts.askKids && attending;
    if (askKids && (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k > LIMITS.kidsMax)) fail(`Kids must be 0 to ${LIMITS.kidsMax}`);
    return { ok: true, rsvp: { guestName: str(i.guestName, 'Name', LIMITS.rsvpName, true), attending, partySize: attending ? (n as number) : 1, kidsCount: askKids ? (k as number) : 0, message: str(i.message, 'Message', LIMITS.rsvpMessage) } };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

export function makeSlug(base: string, random: string): string {
  const b = base.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return `${b}-${random}`;
}
