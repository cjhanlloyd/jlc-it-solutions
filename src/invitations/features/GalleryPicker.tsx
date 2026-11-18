// The four gallery layouts as radio cards with a small drawing of each. Used by the manage page and the studio.
import { GALLERY_LAYOUTS, type GalleryLayout } from '../../../shared/extras';

const LABELS: Record<GalleryLayout, { name: string; hint: string }> = {
  grid: { name: 'Grid', hint: 'The design’s own photo grid' },
  masonry: { name: 'Masonry', hint: 'Columns that keep each photo’s shape' },
  carousel: { name: 'Carousel', hint: 'One photo at a time, swipe or tap' },
  polaroid: { name: 'Polaroid', hint: 'Tilted white-bordered prints' },
};

const tile = 'rounded-sm bg-slate-400';
function Sketch({ layout }: { layout: GalleryLayout }) {
  if (layout === 'grid') return <div className="grid h-14 grid-cols-2 gap-1"><span className={`${tile} col-span-2`} /><span className={tile} /><span className={tile} /></div>;
  if (layout === 'masonry') return <div className="flex h-14 gap-1"><div className="flex flex-1 flex-col gap-1"><span className={`${tile} h-8`} /><span className={`${tile} flex-1`} /></div><div className="flex flex-1 flex-col gap-1"><span className={`${tile} h-4`} /><span className={`${tile} flex-1`} /></div></div>;
  if (layout === 'carousel') return <div className="flex h-14 flex-col items-center gap-1"><span className={`${tile} w-full flex-1`} /><span className="flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-700" /><span className="h-1.5 w-1.5 rounded-full border border-slate-700" /><span className="h-1.5 w-1.5 rounded-full border border-slate-700" /></span></div>;
  return <div className="flex h-14 items-center justify-center gap-2">{[-6, 5].map((r) => <span key={r} className="block bg-white p-1 pb-3 shadow" style={{ transform: `rotate(${r}deg)` }}><span className={`${tile} block h-7 w-7`} /></span>)}</div>;
}

export default function GalleryPicker({ value, onChange, name }: { value: GalleryLayout; onChange: (v: GalleryLayout) => void; name: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-slate-800">Gallery layout</legend>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GALLERY_LAYOUTS.map((l) => (
          <label key={l} className={`flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-900 ${value === l ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <input type="radio" name={name} value={l} checked={value === l} onChange={() => onChange(l)} className="sr-only" />
            <span aria-hidden="true" className="block rounded-lg bg-slate-100 p-2"><Sketch layout={l} /></span>
            <span className="text-sm font-bold text-slate-900">{LABELS[l].name}</span>
            <span className="text-xs text-slate-700">{LABELS[l].hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
