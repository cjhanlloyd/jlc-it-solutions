// Colour schemes and preview images sections of the design editor.
import { useState, type ChangeEvent } from 'react';
import { optimizeImage } from '../components/admin/images';
import type { Scheme } from '../invitations/parts';
import { Button, TextField } from '../ui';
import { move } from './design-form';

export type NamedScheme = Scheme & { name: string };
const COLOURS: [keyof Scheme, string][] = [['primary', 'Primary'], ['accent', 'Accent'], ['background', 'Background'], ['text', 'Text']];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const NEW_SCHEME: NamedScheme = { name: 'Classic', primary: '#1f2937', accent: '#b8860b', background: '#fffaf3', text: '#1f2937' };

export function SchemesEditor({ schemes, onChange }: { schemes: NamedScheme[]; onChange: (s: NamedScheme[]) => void }) {
  const set = (i: number, patch: Partial<NamedScheme>) => onChange(schemes.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-4">
      {schemes.map((s, i) => (
        <fieldset key={i} className="rounded-control border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Scheme {i + 1}</legend>
          <TextField label="Name" value={s.name} onChange={(e) => set(i, { name: e.target.value })} error={s.name.trim() ? undefined : 'A name is required.'} />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLOURS.map(([k, label]) => (
              <div key={k} className="flex items-end gap-2">
                <input type="color" aria-label={`${label} colour picker`} value={HEX_RE.test(s[k]) ? s[k].toLowerCase() : '#000000'}
                  onChange={(e) => set(i, { [k]: e.target.value })} className="h-10 w-10 shrink-0 cursor-pointer rounded border border-slate-300" />
                <TextField label={label} value={s[k]} maxLength={7} onChange={(e) => set(i, { [k]: e.target.value.trim() })}
                  error={HEX_RE.test(s[k]) ? undefined : 'Use #rrggbb'} className="font-mono" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => onChange(move(schemes, i, -1))} aria-label={`Move scheme ${i + 1} up`}>Up</Button>
            <Button size="sm" variant="secondary" disabled={i === schemes.length - 1} onClick={() => onChange(move(schemes, i, 1))} aria-label={`Move scheme ${i + 1} down`}>Down</Button>
            <Button size="sm" variant="ghost" disabled={schemes.length <= 1} onClick={() => onChange(schemes.filter((_, j) => j !== i))} aria-label={`Remove colour scheme ${i + 1}`}>Remove</Button>
          </div>
        </fieldset>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...schemes, { ...NEW_SCHEME, name: '' }])}>Add colour scheme</Button>
    </div>
  );
}

const MAX_IMAGES = 6;

export function ImagesEditor({ images, onChange }: { images: string[]; onChange: (i: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from<File>(e.target.files || []).slice(0, MAX_IMAGES - images.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const added = await Promise.all(files.map((f) => optimizeImage(f, 1600, 2000, 0.85)));
      onChange([...images, ...added]);
    } catch {
      setError('That image could not be read. Use a JPEG, PNG or WebP file.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <li key={i} className="rounded-control border border-slate-200 p-2">
              <img src={src} alt={`Preview image ${i + 1}`} className="aspect-[4/5] w-full rounded object-cover" />
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="secondary" disabled={busy || i === 0} onClick={() => onChange(move(images, i, -1))} aria-label={`Move image ${i + 1} earlier`}>←</Button>
                <Button size="sm" variant="secondary" disabled={busy || i === images.length - 1} onClick={() => onChange(move(images, i, 1))} aria-label={`Move image ${i + 1} later`}>→</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        {images.length < MAX_IMAGES ? (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-within:outline-2 focus-within:outline-brand-600">
            {busy ? 'Preparing…' : 'Add images'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={add} className="sr-only" />
          </label>
        ) : <p className="text-sm text-slate-600">Up to {MAX_IMAGES} images.</p>}
        <p className="mt-1 text-xs text-slate-600">JPEG, PNG or WebP. Images are resized before upload; the first one is the shop thumbnail.</p>
        {error && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </div>
  );
}
