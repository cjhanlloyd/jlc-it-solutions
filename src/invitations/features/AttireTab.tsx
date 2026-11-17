// Manage page "Attire & motif": motif, palette and notes (saved as extras), plus up to 6 sample attire photos.
import React from 'react';
import { Trash2 } from 'lucide-react';
import { ATTIRE_PHOTOS_MAX, type Extras } from '../../../shared/extras';
import { LIMITS } from '../../../shared/invitation-fields';
import { Alert, inputCls, photoSrc } from '../kit';
import { resizePhoto } from '../studio/resize';
import AttireFields, { cleanAttire } from './AttireFields';
import { btnCls, OFFLINE, postJson, type Api } from './shared';

export type AttirePhoto = { id: number; key: string; caption: string };

export default function AttireTab({ api, extras, onExtras, photos, onPhotos }: { api: Api; extras: Extras; onExtras: (e: Extras) => void; photos: AttirePhoto[]; onPhotos: (p: AttirePhoto[]) => void }) {
  const [attire, setAttire] = React.useState(extras.attire ?? {});
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [caption, setCaption] = React.useState('');

  async function run(fn: () => Promise<Response>, ok: (b: any) => void, done?: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fn();
      const b = await res.json().catch(() => ({}));
      if (res.ok) { ok(b); if (done) setMsg({ kind: 'success', text: done }); } else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const { attire: _old, ...rest } = extras;
    const clean = cleanAttire(attire);
    return run(() => postJson(api, '/extras', { extras: clean ? { ...rest, attire: clean } : rest }), (b) => onExtras(b.extras), 'Saved. Your guests see the changes right away.');
  };
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    let photo: string;
    try { photo = await resizePhoto(f); } catch { return setMsg({ kind: 'error', text: 'We could not read that image. Please use a JPEG or PNG image.' }); }
    if (photo.length > LIMITS.photoChars) return setMsg({ kind: 'error', text: 'That image is too large. Please pick a smaller one.' });
    await run(() => postJson(api, '/attire', { photo, caption }), (b) => { onPhotos([...photos, b.photo]); setCaption(''); }, 'Photo added.');
  }
  const rename = (p: AttirePhoto, text: string) => onPhotos(photos.map((x) => (x.id === p.id ? { ...x, caption: text } : x)));

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <AttireFields value={attire} onChange={setAttire} idPrefix="manage-attire" />
        <button type="submit" disabled={busy} className={btnCls}>Save attire</button>
      </form>

      <section aria-labelledby="attire-photos-h" className="space-y-3 border-t border-slate-200 pt-6">
        <h3 id="attire-photos-h" className="text-sm font-extrabold text-slate-900 font-display">Sample attire photos ({photos.length}/{ATTIRE_PHOTOS_MAX})</h3>
        {photos.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <img src={photoSrc(p.key)} alt={p.caption || `Attire photo ${i + 1}`} className="h-40 w-full rounded-xl object-cover" />
                <label className="block text-xs font-bold text-slate-700">Caption
                  <input className={`${inputCls} mt-1`} maxLength={80} value={p.caption} onChange={(e) => rename(p, e.target.value)}
                    onBlur={(e) => run(() => postJson(api, '/attire/update', { id: p.id, caption: e.target.value }), () => {})} />
                </label>
                <button type="button" disabled={busy} onClick={() => run(() => postJson(api, '/attire/delete', { id: p.id }), () => onPhotos(photos.filter((x) => x.id !== p.id)), 'Photo removed.')}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-red-700 underline cursor-pointer"><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove photo<span className="sr-only"> {i + 1}</span></button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < ATTIRE_PHOTOS_MAX && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Caption for the next photo (optional)
              <input className={`${inputCls} mt-1`} maxLength={80} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </label>
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add an attire photo" disabled={busy} onChange={upload} className="block w-full text-sm text-slate-700" />
          </div>
        )}
      </section>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
