// The plain-text front of an invitation, so one layout (Portrait) can render any occasion.
export type Card = { kicker: string; headline: string; subline: string; dateLine: string; venueLine: string };

export const formatDate = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
export const longDate = (d: string) => formatDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export function time12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "Sunday, February 14, 2027 · 3:30 PM"; '' without a date.
export const dateLine = (d: { eventDate?: string; eventTime?: string }) =>
  d.eventDate ? longDate(d.eventDate) + (d.eventTime ? ` · ${time12(d.eventTime)}` : '') : '';

export const joinNames = (names: (string | undefined)[], sep: string) => names.filter(Boolean).join(sep);
