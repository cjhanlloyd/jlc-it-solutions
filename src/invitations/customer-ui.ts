// Pure helpers for the account page, the manage page's guest links and the guest RSVP. No React or DOM imports: node tests load this file.

export type GuestRsvp = { attending: boolean; partySize: number; kidsCount?: number; submitted?: string };
export type GuestRow = { id: number; name: string; seats: number; token: string; createdAt?: string; rsvp: GuestRsvp | null };
export type CustomerSession = { token: string; email: string };

export const guestLink = (origin: string, slug: string, token: string) => `${origin}/i/${slug}?g=${encodeURIComponent(token)}`;

// "Name: url" lines, one per guest, for pasting into a chat or a spreadsheet.
export const copyAllText = (guests: GuestRow[], origin: string, slug: string) =>
  guests.map((g) => `${g.name}: ${guestLink(origin, slug, g.token)}`).join('\n');

export function guestStatus(g: Pick<GuestRow, 'rsvp'>): string {
  if (!g.rsvp) return 'Not replied yet';
  return g.rsvp.attending ? `Attending · ${g.rsvp.partySize + (g.rsvp.kidsCount ?? 0)}` : "Can't make it";
}

export function guestSummary(guests: GuestRow[]): string {
  const replied = guests.filter((g) => g.rsvp).length;
  return `${guests.length} ${guests.length === 1 ? 'guest' : 'guests'} · ${replied} replied`;
}

// Choices for one RSVP count (adults from 1, kids from 0) up to its own limit; with a guest's seats, also so that
// this count plus the other one (kids for adults, adults for kids) stays within the seats.
export function seatOptions(min: number, limit: number, seats?: number, other = 0): number[] {
  const max = Math.max(min, seats == null ? limit : Math.min(limit, seats - other));
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

// Signed-in customer, kept in localStorage. Storage can throw (private mode, blocked site data), so every access is guarded.
const KEY = 'jlc_customer';
export function readSession(): CustomerSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s && typeof s.token === 'string' && typeof s.email === 'string' ? s : null;
  } catch { return null; }
}
export function saveSession(s: CustomerSession) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* the session then lasts only this page view */ }
}
export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
