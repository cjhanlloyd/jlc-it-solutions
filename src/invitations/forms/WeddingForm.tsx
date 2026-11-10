// The wedding form pieces, moved unchanged from kit.tsx.
import * as Icons from 'lucide-react';
import React from 'react';
import { LIMITS, type Venue } from '../../../shared/invitation-fields';
import { validateDetails, type InvitationDetails } from '../../../shared/occasions/wedding';
import { Field, Section, inputCls } from '../kit';

// The form always holds every field as a string; validateDetails drops the empty optional ones.
export type Draft = InvitationDetails & { reception: Venue; dressCode: string; message: string; rsvpDeadline: string; giftsNote: string };
const emptyVenue = (): Venue => ({ name: '', address: '', mapUrl: '' });
export const toDraft = (d?: Partial<InvitationDetails>): Draft => ({
  partner1: '', partner2: '', eventDate: '', eventTime: '', schedule: [],
  dressCode: '', message: '', rsvpDeadline: '', giftsNote: '',
  ...d,
  ceremony: { ...emptyVenue(), ...d?.ceremony },
  reception: { ...emptyVenue(), ...d?.reception },
});

// validateDetails silently drops a reception without a name, so the form insists on it instead.
export const receptionNeedsName = (d: Draft) => !d.reception.name.trim() && !!(d.reception.address.trim() || d.reception.mapUrl.trim());
export function checkDraft(d: Draft) {
  if (receptionNeedsName(d)) return { ok: false as const, error: 'Reception name is required (or clear the reception fields)' };
  return validateDetails(d);
}

// While required fields are empty or half-typed, the preview borrows them from `fallback` (the design sample or the saved details).
export function previewDetails(d: Draft, fallback: Draft): InvitationDetails {
  return {
    ...d,
    partner1: d.partner1.trim() || fallback.partner1 || 'Partner',
    partner2: d.partner2.trim() || fallback.partner2 || 'Partner',
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(d.eventDate) ? d.eventDate : fallback.eventDate,
    ceremony: d.ceremony.name.trim() ? d.ceremony : fallback.ceremony,
    reception: d.reception.name.trim() ? d.reception : undefined,
    schedule: d.schedule.filter((s) => s.time && s.label.trim()),
  };
}

// The details form used by the customiser and the manage page. `lockNames` shows the partner names read-only.
export function DetailsForm({ draft, onChange, lockNames = false }: { draft: Draft; onChange: (d: Draft) => void; lockNames?: boolean }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setVenue = (k: 'ceremony' | 'reception', patch: Partial<Venue>) => set({ [k]: { ...draft[k], ...patch } });
  const setItem = (i: number, patch: Partial<Draft['schedule'][number]>) =>
    set({ schedule: draft.schedule.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const text = (k: 'dressCode' | 'message' | 'giftsNote') => ({
    value: draft[k], maxLength: LIMITS[k], onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ [k]: e.target.value }),
  });
  const venueFields = (k: 'ceremony' | 'reception', label: string) => (
    <>
      <Field label={`${label} venue name${k === 'ceremony' ? ' *' : ''}`} error={k === 'reception' && receptionNeedsName(draft) ? 'Please add the reception venue name, or clear the reception fields.' : undefined}>
        <input className={inputCls} value={draft[k].name} maxLength={LIMITS.venueName} required={k === 'ceremony'} onChange={(e) => setVenue(k, { name: e.target.value })} placeholder={k === 'ceremony' ? 'e.g. San Agustin Church' : 'e.g. The Manila Hotel'} />
      </Field>
      <Field label="Address">
        <input className={inputCls} value={draft[k].address} maxLength={LIMITS.address} onChange={(e) => setVenue(k, { address: e.target.value })} />
      </Field>
      <Field label="Google Maps link" hint="Open the place in Google Maps, tap Share, copy the link and paste it here.">
        <input className={inputCls} type="url" inputMode="url" value={draft[k].mapUrl} maxLength={LIMITS.mapUrl} onChange={(e) => setVenue(k, { mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
      </Field>
    </>
  );

  return (
    <div className="space-y-6">
      <Section title="The couple">
        <div className="grid sm:grid-cols-2 gap-4">
          {(['partner1', 'partner2'] as const).map((k, i) => (
            <div key={k}><Field label={`Partner ${i + 1} name *`}>
              <input className={inputCls} value={draft[k]} maxLength={LIMITS.name} required disabled={lockNames} onChange={(e) => set({ [k]: e.target.value })} placeholder={i ? 'e.g. Juan' : 'e.g. Maria'} />
            </Field></div>
          ))}
        </div>
        {lockNames
          ? <p className="text-xs text-slate-500">Names can't be changed after payment. Contact us if there's a typo.</p>
          : <p className="text-xs text-slate-500">Please double-check the spelling: names can't be changed after payment.</p>}
      </Section>

      <Section title="When">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Wedding date *">
            <input className={inputCls} type="date" value={draft.eventDate} required min={new Date().toISOString().slice(0, 10) /* UTC, like the server check */} onChange={(e) => set({ eventDate: e.target.value })} />
          </Field>
          <Field label="Start time">
            <input className={inputCls} type="time" value={draft.eventTime} onChange={(e) => set({ eventTime: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Ceremony">{venueFields('ceremony', 'Ceremony')}</Section>
      <Section title="Reception (optional)">{venueFields('reception', 'Reception')}</Section>

      <Section title="Schedule (optional)">
        {draft.schedule.map((s, i) => (
          <div key={i} className="flex gap-2 items-end">
            <Field label="Time">
              <input className={`${inputCls} w-32`} type="time" value={s.time} required onChange={(e) => setItem(i, { time: e.target.value })} />
            </Field>
            <div className="flex-1">
              <Field label="What happens">
                <input className={inputCls} value={s.label} maxLength={LIMITS.scheduleLabel} required onChange={(e) => setItem(i, { label: e.target.value })} placeholder="e.g. Cocktails" />
              </Field>
            </div>
            <button type="button" onClick={() => set({ schedule: draft.schedule.filter((_, j) => j !== i) })} className="p-3 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label={`Remove schedule item ${i + 1}`}>
              <Icons.Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {draft.schedule.length < LIMITS.scheduleItems && (
          <button type="button" onClick={() => set({ schedule: [...draft.schedule, { time: '', label: '' }] })} className="inline-flex items-center text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:text-slate-900 cursor-pointer">
            <Icons.Plus className="h-4 w-4 mr-1" /> Add schedule item
          </button>
        )}
      </Section>

      <Section title="Notes for guests (optional)">
        <Field label="Message to guests"><textarea className={inputCls} rows={4} {...text('message')} /></Field>
        <Field label="Dress code / colour motif"><textarea className={inputCls} rows={2} {...text('dressCode')} /></Field>
        <Field label="Gifts note"><textarea className={inputCls} rows={2} {...text('giftsNote')} /></Field>
        <Field label="RSVP deadline" hint="Guests can't RSVP after this date.">
          <input className={inputCls} type="date" value={draft.rsvpDeadline} onChange={(e) => set({ rsvpDeadline: e.target.value })} />
        </Field>
      </Section>
    </div>
  );
}

