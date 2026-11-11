import * as Icons from 'lucide-react';
import React from 'react';
import { LIMITS, type Venue } from '../../../shared/invitation-fields';
import { TRADITIONS } from '../../../shared/occasions/debut';
import { Field, Section, inputCls } from '../kit';
import { lines, type DebutDraft } from './debut-draft';

export function DebutForm({ draft, onChange, lockNames = false }: { draft: DebutDraft; onChange: (d: DebutDraft) => void; lockNames?: boolean }) {
  const set = (patch: Partial<DebutDraft>) => onChange({ ...draft, ...patch });
  const setVenue = (patch: Partial<Venue>) => set({ venue: { ...draft.venue, ...patch } });
  const setItem = (i: number, patch: Partial<DebutDraft['schedule'][number]>) =>
    set({ schedule: draft.schedule.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const line = (k: 'headline' | 'theme' | 'hostedBy', label: string, placeholder: string) => (
    <Field label={label}><input className={inputCls} value={draft[k]} maxLength={LIMITS[k]} onChange={(e) => set({ [k]: e.target.value })} placeholder={placeholder} /></Field>
  );
  const text = (k: 'dressCode' | 'message' | 'giftsNote') => ({
    value: draft[k], maxLength: LIMITS[k], onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ [k]: e.target.value }),
  });

  return (
    <div className="space-y-6">
      <Section title="The debutante">
        <Field label="Name *">
          <input className={inputCls} value={draft.debutante} maxLength={LIMITS.name} required disabled={lockNames} onChange={(e) => set({ debutante: e.target.value })} placeholder="e.g. Ana Reyes" />
        </Field>
        {line('headline', 'Headline', 'e.g. A night to remember')}
        {line('theme', 'Theme', 'e.g. Enchanted Garden')}
        <Field label="Escort">
          <input className={inputCls} value={draft.escort} maxLength={LIMITS.name} onChange={(e) => set({ escort: e.target.value })} placeholder="e.g. Miguel Santos" />
        </Field>
        {line('hostedBy', 'Hosted by', 'e.g. Mr. & Mrs. Reyes')}
        {lockNames
          ? <p className="text-xs text-slate-500">The name can't be changed after payment. Contact us if there's a typo.</p>
          : <p className="text-xs text-slate-500">Please double-check the spelling: the name can't be changed after payment.</p>}
      </Section>

      <Section title="When">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Debut date *">
            <input className={inputCls} type="date" value={draft.eventDate} required min={new Date().toISOString().slice(0, 10) /* UTC, like the server check */} onChange={(e) => set({ eventDate: e.target.value })} />
          </Field>
          <Field label="Start time">
            <input className={inputCls} type="time" value={draft.eventTime} onChange={(e) => set({ eventTime: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Venue">
        <Field label="Venue name *">
          <input className={inputCls} value={draft.venue.name} maxLength={LIMITS.venueName} required onChange={(e) => setVenue({ name: e.target.value })} placeholder="e.g. The Rose Ballroom" />
        </Field>
        <Field label="Address">
          <input className={inputCls} value={draft.venue.address} maxLength={LIMITS.address} onChange={(e) => setVenue({ address: e.target.value })} />
        </Field>
        <Field label="Google Maps link" hint="Open the place in Google Maps, tap Share, copy the link and paste it here.">
          <input className={inputCls} type="url" inputMode="url" value={draft.venue.mapUrl} maxLength={LIMITS.mapUrl} onChange={(e) => setVenue({ mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
        </Field>
      </Section>

      <Section title="Program (optional)">
        {draft.schedule.map((s, i) => (
          <div key={i} className="flex gap-2 items-end">
            <Field label="Time">
              <input className={`${inputCls} w-32`} type="time" value={s.time} required onChange={(e) => setItem(i, { time: e.target.value })} />
            </Field>
            <div className="flex-1">
              <Field label="What happens">
                <input className={inputCls} value={s.label} maxLength={LIMITS.scheduleLabel} required onChange={(e) => setItem(i, { label: e.target.value })} placeholder="e.g. Cotillion" />
              </Field>
            </div>
            <button type="button" onClick={() => set({ schedule: draft.schedule.filter((_, j) => j !== i) })} className="p-3 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label={`Remove program item ${i + 1}`}>
              <Icons.Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {draft.schedule.length < LIMITS.scheduleItems && (
          <button type="button" onClick={() => set({ schedule: [...draft.schedule, { time: '', label: '' }] })} className="inline-flex items-center text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:text-slate-900 cursor-pointer">
            <Icons.Plus className="h-4 w-4 mr-1" /> Add program item
          </button>
        )}
      </Section>

      <Section title="Traditions (optional)">
        <p className="text-xs text-slate-500">One name per line, up to {LIMITS.traditionNames}. Leave a list empty if you're not doing that tradition.</p>
        {TRADITIONS.map((t) => {
          const n = lines(draft[t.key]).length;
          return (
            <React.Fragment key={t.key}><Field label={t.label} hint={`${n} of ${LIMITS.traditionNames} names`}>
              <textarea className={inputCls} rows={4} value={draft[t.key]} onChange={(e) => set({ [t.key]: e.target.value })} aria-invalid={n > LIMITS.traditionNames || undefined} />
            </Field></React.Fragment>
          );
        })}
      </Section>

      <Section title="Notes for guests (optional)">
        <Field label="Message to guests"><textarea className={inputCls} rows={4} {...text('message')} /></Field>
        <Field label="Attire"><textarea className={inputCls} rows={2} {...text('dressCode')} /></Field>
        <Field label="Gift note"><textarea className={inputCls} rows={2} {...text('giftsNote')} /></Field>
        <Field label="RSVP deadline" hint="Guests can't RSVP after this date.">
          <input className={inputCls} type="date" value={draft.rsvpDeadline} onChange={(e) => set({ rsvpDeadline: e.target.value })} />
        </Field>
      </Section>
    </div>
  );
}
