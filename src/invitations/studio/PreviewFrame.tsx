// Live preview at a fixed render width (phone 400 px, desktop 1024 px) scaled to fit the pane, like DesignCard's
// live render. With a cover and onFocus, the hero gets a drag/arrow-key handle that moves the cover's focal point.
import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { Cover } from '../../../shared/invitation-style';
import { dragFocus, nudgeFocus } from './cover';

const WIDTH = { phone: 400, desktop: 1024 };
const BEZEL = 12;
type Box = { top: number; left: number; width: number; height: number };
const same = (a: Box | null, b: Box | null) => JSON.stringify(a) === JSON.stringify(b);

function CoverHandle({ box, cover, scale, onFocus }: { box: Box; cover: Cover; scale: number; onFocus: (f: { x: number; y: number }) => void }) {
  const start = React.useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const end = () => { start.current = null; };
  return (
    <button type="button"
      aria-label={`Cover photo position: ${Math.round(cover.x)}% across, ${Math.round(cover.y)}% down. Drag, or use the arrow keys, to move the photo.`}
      className="absolute cursor-move bg-transparent hover:outline-dashed focus-visible:outline-solid outline-sky-500"
      style={{ ...box, touchAction: 'none', outlineWidth: 2 / scale, outlineOffset: -4 / scale }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { px: e.clientX, py: e.clientY, x: cover.x, y: cover.y }; }}
      onPointerMove={(e) => { const s = start.current; if (s) onFocus(dragFocus(s, e.clientX - s.px, e.clientY - s.py, scale, box.width, box.height)); }}
      onPointerUp={end} onPointerCancel={end}
      onKeyDown={(e) => { const f = nudgeFocus(cover, e.key); if (f) { e.preventDefault(); onFocus(f); } }}
    />
  );
}

export default function PreviewFrame({ children, cover, onFocus }: { children: React.ReactNode; cover?: Cover; onFocus?: (f: { x: number; y: number }) => void }) {
  const [mode, setMode] = React.useState<'phone' | 'desktop'>('phone');
  const pane = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [hero, setHero] = React.useState<Box | null>(null);
  const width = WIDTH[mode];
  const bezel = mode === 'phone' ? BEZEL : 1;
  const scale = paneW > 0 ? Math.min(1, (paneW - bezel * 2) / width) : 0;

  React.useEffect(() => {
    const ro = new ResizeObserver(() => { setPaneW(pane.current?.clientWidth ?? 0); setHeight(inner.current?.offsetHeight ?? 0); });
    ro.observe(pane.current!);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [scale > 0]);

  // Where the hero sits, in unscaled render px, so the handle can cover it exactly.
  React.useLayoutEffect(() => {
    const el = inner.current?.querySelector<HTMLElement>('.inv-cover');
    let next: Box | null = null;
    if (el && inner.current && scale > 0) {
      const a = el.getBoundingClientRect(), b = inner.current.getBoundingClientRect();
      next = { top: Math.round((a.top - b.top) / scale), left: Math.round((a.left - b.left) / scale), width: Math.round(a.width / scale), height: Math.round(a.height / scale) };
    }
    if (!same(next, hero)) setHero(next);
  });

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div role="group" aria-label="Preview size" className="flex justify-center gap-2">
        {(['phone', 'desktop'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${mode === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {m === 'phone' ? <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> : <Monitor className="h-3.5 w-3.5" aria-hidden="true" />}
            {m === 'phone' ? 'Phone' : 'Desktop'}
          </button>
        ))}
      </div>
      <div ref={pane} className="flex justify-center">
        {scale > 0 && (
          <div className={`overflow-hidden bg-white ${mode === 'phone' ? 'rounded-[2.5rem] border-slate-900 shadow-xl' : 'rounded-xl border-slate-200'}`}
            style={{ width: width * scale + bezel * 2, borderWidth: bezel }}>
            <div style={{ height: height * scale }}>
              <div ref={inner} className="relative" style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {children}
                {cover && onFocus && hero && <CoverHandle box={hero} cover={cover} scale={scale} onFocus={onFocus} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
