// Pure birthday draft helpers; no React so the node tests can load them.
import type { Venue } from '../../../shared/invitation-fields.ts';
import { birthday, type BirthdayDetails } from '../../../shared/occasions/birthday.ts';

export type BirthdayDraft = Omit<BirthdayDetails, 'age' | 'venue'> & {
  age: string; venue: Venue; headline: string; theme: string; hostedBy: string;
  dressCode: string; giftsNote: string; message: string; rsvpDeadline: string;
};
const emptyVenue = (): Venue => ({ name: '', address: '', mapUrl: '' });

// The form holds every field as a string (age included); checkBirthdayDraft sends age as a number.
export const toBirthdayDraft = (d?: Partial<BirthdayDetails>): BirthdayDraft => ({
  celebrant: '', eventDate: '', eventTime: '', schedule: [],
  headline: '', theme: '', hostedBy: '', dressCode: '', giftsNote: '', message: '', rsvpDeadline: '',
  ...d,
  age: d?.age ? String(d.age) : '',
  venue: { ...emptyVenue(), ...d?.venue },
});

export function checkBirthdayDraft(d: BirthdayDraft) {
  const { age, ...rest } = d;
  const a = age.trim();
  return birthday.validateDetails(a ? { ...rest, age: /^\d+$/.test(a) ? Number(a) : NaN } : rest);
}

// While required fields are blank or half-typed, the preview borrows them from `fallback` (the design sample or saved details).
export function previewBirthday(d: BirthdayDraft, fallback: BirthdayDraft): BirthdayDetails {
  const age = /^\d{1,3}$/.test(d.age.trim()) ? Number(d.age) : undefined;
  return {
    ...d, age,
    celebrant: d.celebrant.trim() || fallback.celebrant || 'Celebrant',
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(d.eventDate) ? d.eventDate : fallback.eventDate,
    venue: d.venue.name.trim() ? d.venue : fallback.venue,
    schedule: d.schedule.filter((s) => s.time && s.label.trim()),
  };
}
