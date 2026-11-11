// Pure debut draft helpers; no React so the node tests can load them.
import type { Venue } from '../../../shared/invitation-fields.ts';
import { TRADITIONS, debut, type DebutDetails, type TraditionKey } from '../../../shared/occasions/debut.ts';

// Tradition lists are edited as one name per line.
export type DebutDraft = Omit<DebutDetails, TraditionKey | 'venue'> & Record<TraditionKey, string> & {
  venue: Venue; headline: string; theme: string; hostedBy: string; escort: string;
  dressCode: string; giftsNote: string; message: string; rsvpDeadline: string;
};
const emptyVenue = (): Venue => ({ name: '', address: '', mapUrl: '' });
export const lines = (s: string): string[] => s.split('\n').map((n) => n.trim()).filter(Boolean);

export const toDebutDraft = (d?: Partial<DebutDetails>): DebutDraft => ({
  debutante: '', eventDate: '', eventTime: '', schedule: [],
  headline: '', theme: '', hostedBy: '', escort: '', dressCode: '', giftsNote: '', message: '', rsvpDeadline: '',
  ...d,
  roses: (d?.roses ?? []).join('\n'), candles: (d?.candles ?? []).join('\n'), treasures: (d?.treasures ?? []).join('\n'),
  venue: { ...emptyVenue(), ...d?.venue },
});

const toLists = (d: DebutDraft) => Object.fromEntries(TRADITIONS.map((t) => [t.key, lines(d[t.key])])) as Record<TraditionKey, string[]>;

export const checkDebutDraft = (d: DebutDraft) => debut.validateDetails({ ...d, ...toLists(d) });

// While required fields are blank or half-typed, the preview borrows them from `fallback` (the design sample or saved details).
export function previewDebut(d: DebutDraft, fallback: DebutDraft): DebutDetails {
  return {
    ...d, ...toLists(d),
    debutante: d.debutante.trim() || fallback.debutante || 'Debutante',
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(d.eventDate) ? d.eventDate : fallback.eventDate,
    venue: d.venue.name.trim() ? d.venue : fallback.venue,
    schedule: d.schedule.filter((s) => s.time && s.label.trim()),
  };
}
