// Attire motif, colour palette and notes: shared by the studio (before payment) and the manage page's Attire tab.
import React from 'react';
import { Plus, X } from 'lucide-react';
import { EXTRAS_LIMITS, type Extras } from '../../../shared/extras';
import { inputCls, labelCls } from '../kit';

export type Attire = NonNullable<Extras['attire']>;
const L = EXTRAS_LIMITS;

export default function AttireFields({ value, onChange, idPrefix = 'attire' }: { value: Attire; onChange: (a: Attire) => void; idPrefix?: string }) {
  const palette = value.palette ?? [];
  const setPalette = (p: string[]) => onChange({ ...value, palette: p });
  const notes = value.notes ?? '';
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-motif`} className={labelCls}>Motif or theme</label>
        <input id={`${idPrefix}-motif`} className={inputCls} maxLength={L.motif} value={value.motif ?? ''} onChange={(e) => onChange({ ...value, motif: e.target.value })} placeholder="e.g. Garden formal in dusty rose and sage" />
      </div>
      <fieldset>
        <legend className={labelCls}>Colour palette (up to {L.palette})</legend>
        <ul className="flex flex-wrap gap-3">
          {palette.map((c, i) => (
            <li key={i} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
              <input type="color" aria-label={`Palette colour ${i + 1}`} value={c} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 w-11 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
              <button type="button" aria-label={`Remove palette colour ${i + 1}`} onClick={() => setPalette(palette.filter((_, j) => j !== i))} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"><X className="h-4 w-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        {palette.length < L.palette && (
          <button type="button" onClick={() => setPalette([...palette, '#d8a7b1'])} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"><Plus className="h-4 w-4" aria-hidden="true" /> Add a colour</button>
        )}
      </fieldset>
      <div>
        <label htmlFor={`${idPrefix}-notes`} className={labelCls}>Attire notes</label>
        <textarea id={`${idPrefix}-notes`} rows={4} maxLength={L.notes} className={inputCls} value={notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} aria-describedby={`${idPrefix}-notes-count`} />
        <p id={`${idPrefix}-notes-count`} className="mt-1 text-right text-xs text-slate-600">{notes.length}/{L.notes}</p>
      </div>
    </div>
  );
}

// Drops empty fields so an untouched form sends no attire at all.
export function cleanAttire(a: Attire): Attire | undefined {
  const out: Attire = {};
  if (a.motif?.trim()) out.motif = a.motif.trim();
  if (a.palette?.length) out.palette = a.palette;
  if (a.notes?.trim()) out.notes = a.notes.trim();
  return Object.keys(out).length ? out : undefined;
}
