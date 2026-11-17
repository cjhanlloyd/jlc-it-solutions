// Premium extras: the opening animation switch and the background music picker (one shared <audio> for previews).
import React from 'react';
import { Pause, Play } from 'lucide-react';
import type { InvitationStyle } from '../../../shared/invitation-style';

export type Track = { id: number; title: string; credit: string; url: string };
export type Tracks = Track[] | null | 'offline'; // null = loading

// Fetched once per page, and only when a Premium package is active; a failure just hides the picker.
export function useTracks(enabled: boolean): Tracks {
  const [tracks, setTracks] = React.useState<Tracks>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch('/api/invitations/music')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setTracks(d.tracks))
      .catch(() => alive && setTracks('offline'));
    return () => { alive = false; };
  }, [enabled]);
  return tracks;
}

const focusCls = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

export default function PremiumExtras({ tracks, style, onStyle, active = true }: { tracks: Tracks; style: InvitationStyle; onStyle: (s: InvitationStyle) => void; active?: boolean }) {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState<number | null>(null);
  const stop = React.useCallback(() => { audio.current?.pause(); setPlaying(null); }, []);
  React.useEffect(() => {
    const hide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); audio.current?.pause(); };
  }, [stop]);
  React.useEffect(() => { if (!active) stop(); }, [active, stop]);

  const preview = (t: Track) => {
    if (playing === t.id) return stop();
    const a = (audio.current ??= new Audio());
    a.src = t.url;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(t.id)).catch(() => setPlaying(null));
  };
  const { intro: _i, ...noIntro } = style;
  const { music: _m, ...noMusic } = style;
  const radio = 'h-4 w-4 shrink-0';

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-extrabold text-slate-900 font-display pr-3">Premium extras</legend>
      <label className={`flex items-center gap-3 text-sm font-semibold text-slate-800 ${focusCls}`}>
        <input type="checkbox" className="h-4 w-4" checked={style.intro !== false} onChange={(e) => onStyle(e.target.checked ? noIntro : { ...style, intro: false })} />
        Opening animation
      </label>
      <div role="radiogroup" aria-label="Background music" className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Background music</p>
        {tracks === null && <p className="text-xs text-slate-600">Loading music…</p>}
        {tracks === 'offline' && <p className="text-xs text-slate-600">Music is unavailable right now.</p>}
        {Array.isArray(tracks) && (
          <>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 text-sm text-slate-800 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate-900">
              <input type="radio" name="studio-music" className={radio} checked={style.music === undefined} onChange={() => onStyle(noMusic)} />
              No music
            </label>
            {style.music !== undefined && !tracks.some((t) => t.id === style.music) && (
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 text-sm text-slate-800 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate-900">
                <input type="radio" name="studio-music" className={radio} checked readOnly />
                Current track (no longer available)
              </label>
            )}
            {tracks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-slate-800 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate-900">
                  <input type="radio" name="studio-music" className={radio} checked={style.music === t.id} onChange={() => onStyle({ ...style, music: t.id })} />
                  <span className="min-w-0"><span className="block font-semibold truncate">{t.title}</span><span className="block text-xs text-slate-600 truncate">{t.credit}</span></span>
                </label>
                <button type="button" onClick={() => preview(t)} aria-label={playing === t.id ? 'Pause preview' : `Play preview of ${t.title}`}
                  className={`shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full border border-slate-300 text-slate-800 hover:bg-slate-100 cursor-pointer ${focusCls}`}>
                  {playing === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              </div>
            ))}
            {!tracks.length && <p className="text-xs text-slate-600">No music is available yet.</p>}
          </>
        )}
      </div>
    </fieldset>
  );
}
