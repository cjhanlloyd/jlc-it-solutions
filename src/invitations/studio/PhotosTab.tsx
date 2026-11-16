// Photos & cover tab: add up to 6 photos, reorder them (buttons or drag), pick one as the cover and tune its overlay.
import React from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react';
import { LIMITS } from '../../../shared/invitation-fields';
import type { Cover, InvitationStyle } from '../../../shared/invitation-style';
import { photoSrc } from '../kit';
import { MIN_OVERLAY } from '../style-render';
import { READABLE, averageRgb, coverContrast, followCover, strengthToRead } from './cover';
import { resizePhoto } from './resize';

const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,/;
const legendCls = 'text-sm font-extrabold text-slate-900 font-display pr-3';
const iconBtn = 'p-1.5 rounded-full bg-white/90 text-slate-700 hover:text-slate-950 cursor-pointer disabled:opacity-40 disabled:cursor-default';
const NEW_COVER: Omit<Cover, 'photo'> = { x: 50, y: 50, zoom: 1, tone: 'dark', strength: 0.45, fade: false };
const TONES: [Cover['tone'], string][] = [['dark', 'Dark'], ['light', 'Light'], ['scheme', 'Scheme colour']];

// Average colour of the visible cover crop, from a 32 px canvas copy.
// shortcut: samples the whole zoomed crop around the focal point, not the hero's exact aspect or text box; good enough for a hint.
function useCoverAverage(src: string | null, c: Cover | undefined) {
  const [avg, setAvg] = React.useState<number[] | null>(null);
  const x = c?.x, y = c?.y, zoom = c?.zoom ?? 1;
  React.useEffect(() => {
    if (!src || x === undefined || y === undefined) return setAvg(null);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const w = img.naturalWidth / zoom, h = img.naturalHeight / zoom;
      ctx.drawImage(img, ((img.naturalWidth - w) * x) / 100, ((img.naturalHeight - h) * y) / 100, w, h, 0, 0, 32, 32);
      try { setAvg(averageRgb(ctx.getImageData(0, 0, 32, 32).data)); } catch { setAvg(null); }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src, x, y, zoom]);
  return avg;
}

type Props = { photos: string[]; onPhotos: React.Dispatch<React.SetStateAction<string[]>>; style: InvitationStyle; onStyle: (s: InvitationStyle) => void; primary: string };

export default function PhotosTab({ photos, onPhotos, style, onStyle, primary }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const dragFrom = React.useRef<number | null>(null);
  const cover = style.cover;
  const coverIndex = typeof cover?.photo === 'number' && photos[cover.photo] ? cover.photo : -1;
  const avg = useCoverAverage(coverIndex >= 0 ? photoSrc(photos[coverIndex]) : null, cover);

  const change = (next: string[]) => { onStyle(followCover(style, photos, next)); onPhotos(next); };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    next.splice(to, 0, ...next.splice(from, 1));
    change(next);
  };
  const setCover = (patch: Partial<Cover>) => cover && onStyle({ ...style, cover: { ...cover, ...patch } });
  const { cover: _c, ...noCover } = style;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, LIMITS.photos - photos.length)) {
      try {
        const url = await resizePhoto(f);
        if (!PHOTO_RE.test(url)) setError('Please use JPEG, PNG or WebP photos.');
        else if (url.length > LIMITS.photoChars) setError('One photo is too large even after compressing. Please pick a smaller one.');
        else added.push(url);
      } catch {
        setError('We could not read one of the photos. Please use JPEG or PNG photos.');
      }
    }
    if (files.length > LIMITS.photos - photos.length) setError(`You can add up to ${LIMITS.photos} photos.`);
    // Appending never moves the cover, so only photos change: style edits made while resizing are kept.
    onPhotos((cur) => [...cur, ...added].slice(0, LIMITS.photos));
    setBusy(false);
  };

  const ratio = avg && cover ? coverContrast(avg, cover, primary) : null;
  const strength = Math.max(cover?.strength ?? MIN_OVERLAY, MIN_OVERLAY);

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className={legendCls}>Photos (up to {LIMITS.photos})</legend>
        <p className="text-xs text-slate-600">Drag photos or use the arrows to change their order. Pick one as the cover of your invitation.</p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.slice(-40) + i} draggable onDragStart={() => { dragFrom.current = i; }} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; }}
              className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-grab ${i === coverIndex ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}>
              <img src={photoSrc(p)} alt={`Photo ${i + 1}${i === coverIndex ? ' (cover)' : ''}`} className="w-full h-full object-cover pointer-events-none" />
              <button type="button" onClick={() => change(photos.filter((_, j) => j !== i))} className={`absolute top-1 right-1 ${iconBtn} hover:text-red-600`} aria-label={`Remove photo ${i + 1}`}>
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex items-center gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className={iconBtn} aria-label={`Move photo ${i + 1} earlier`}><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1} className={iconBtn} aria-label={`Move photo ${i + 1} later`}><ChevronRight className="h-4 w-4" /></button>
                <button type="button" aria-pressed={i === coverIndex} onClick={() => onStyle({ ...style, cover: { photo: i, ...NEW_COVER } })}
                  className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold cursor-pointer ${i === coverIndex ? 'bg-slate-900 text-white' : 'bg-white/90 text-slate-800'}`}>
                  <Star className="h-3 w-3" aria-hidden="true" />{i === coverIndex ? 'Cover' : 'Use as cover'}
                  <span className="sr-only">: photo {i + 1}</span>
                </button>
              </div>
            </li>
          ))}
          {photos.length < LIMITS.photos && (
            <li>
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 flex flex-col items-center justify-center text-slate-600 text-xs font-bold cursor-pointer text-center p-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900">
                <ImagePlus className="h-6 w-6 mb-1" />
                {busy ? 'Adding…' : 'Add photos'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
              </label>
            </li>
          )}
        </ul>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </fieldset>

      {cover && coverIndex >= 0 && (
        <fieldset className="space-y-4 border-t border-slate-200 pt-6">
          <legend className={legendCls}>Cover photo</legend>
          <p className="text-xs text-slate-600">Drag the photo on the preview, or focus it and use the arrow keys, to position it.</p>
          <label className="block text-sm font-semibold text-slate-700">
            Zoom: {Math.round(cover.zoom * 100)}%
            <input type="range" min={100} max={300} step={5} value={Math.round(cover.zoom * 100)} onChange={(e) => setCover({ zoom: Number(e.target.value) / 100 })} className="block w-full mt-1 accent-slate-900" />
          </label>
          <div role="radiogroup" aria-label="Overlay tone" className="flex flex-wrap gap-2">
            {TONES.map(([t, label]) => (
              <label key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer has-[:checked]:border-slate-900 has-[:checked]:ring-1 has-[:checked]:ring-slate-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate-900">
                <input type="radio" name="cover-tone" className="sr-only" checked={cover.tone === t} onChange={() => setCover({ tone: t })} />{label}
              </label>
            ))}
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Overlay strength: {Math.round(strength * 100)}%
            <input type="range" min={MIN_OVERLAY * 100} max={80} step={5} value={Math.round(strength * 100)} onChange={(e) => setCover({ strength: Number(e.target.value) / 100 })} className="block w-full mt-1 accent-slate-900" />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={cover.fade} onChange={(e) => setCover({ fade: e.target.checked })} /> Fade the photo into the page
          </label>
          {ratio !== null && (
            <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ratio >= READABLE ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                Text readability: {ratio >= READABLE ? 'Readable' : 'Low'}
              </span>
              {ratio < READABLE && strength < 0.8 && (
                <button type="button" onClick={() => setCover({ strength: strengthToRead(avg!, cover, primary) })} className="text-xs font-bold text-slate-900 underline cursor-pointer">Increase overlay</button>
              )}
            </div>
          )}
          <button type="button" onClick={() => onStyle(noCover)} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:bg-slate-100 cursor-pointer">Remove cover</button>
        </fieldset>
      )}
    </div>
  );
}
