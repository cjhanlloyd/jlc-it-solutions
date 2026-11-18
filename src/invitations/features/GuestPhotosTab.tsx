// Manage page "Guest photos" (Premium): switch uploads on or off, then approve, reject or delete what guests send.
// Thumbnails come from the authorised preview route, since pending photos are not public.
import React from 'react';
import type { Extras } from '../../../shared/extras';
import { Alert } from '../kit';
import { btnCls, ghostBtn, OFFLINE, postJson, type Api } from './shared';

type Status = 'pending' | 'approved' | 'rejected';
type Photo = { id: number; guestName: string; status: Status; createdAt: string };
const FILTERS: { id: Status; label: string }[] = [{ id: 'pending', label: 'Pending' }, { id: 'approved', label: 'Approved' }, { id: 'rejected', label: 'Rejected' }];

// The header-authenticated preview as a data: URL (the site CSP allows data: images, not blob:)
// Fetched only once it scrolls into view; data: URLs need no revoking.
const PAGE = 24;
function Thumb({ api, id, alt }: { api: Api; id: number; alt: string }) {
  const [src, setSrc] = React.useState('');
  const [seen, setSeen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!seen) return;
    let live = true;
    api(`/media/${id}`).then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => new Promise<string>((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = no; fr.readAsDataURL(b); }))
      .then((u) => { if (live) setSrc(u); }, () => {});
    return () => { live = false; };
  }, [api, id, seen]);
  return src ? <img src={src} alt={alt} className="h-40 w-full rounded-xl object-cover" /> : <div ref={box} className="h-40 w-full rounded-xl bg-slate-100" role="img" aria-label={`${alt} (loading)`} />;
}

export default function GuestPhotosTab({ api, extras, onExtras }: { api: Api; extras: Extras; onExtras: (e: Extras) => void }) {
  const [photos, setPhotos] = React.useState<Photo[] | null>(null);
  const [filter, setFilter] = React.useState<Status>('pending');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [limit, setLimit] = React.useState(PAGE);
  const enabled = extras.guestPhotos?.enabled === true;

  const load = React.useCallback(() => {
    api('/guest-photos').then((r) => r.json()).then((b) => setPhotos(b.photos ?? []), () => setMsg({ kind: 'error', text: OFFLINE }));
  }, [api]);
  React.useEffect(load, [load]);

  async function run(path: string, body: unknown, ok: (b: any) => void, done?: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await postJson(api, path, body);
      const b = await res.json().catch(() => ({}));
      if (res.ok) { ok(b); if (done) setMsg({ kind: 'success', text: done }); } else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
  }
  const toggle = () => run('/extras', { extras: { ...extras, guestPhotos: { enabled: !enabled } } }, (b) => onExtras(b.extras), enabled ? 'Guest uploads are off.' : 'Guest uploads are on. Guests see "Share your photos" under your gallery.');
  const act = (p: Photo, action: 'approve' | 'reject' | 'delete') => run('/guest-photos', { action, id: p.id }, () => setPhotos((all) =>
    action === 'delete' ? all!.filter((x) => x.id !== p.id) : all!.map((x) => (x.id === p.id ? { ...x, status: action === 'approve' ? 'approved' : 'rejected' } : x))));
  const approveAll = () => run('/guest-photos', { action: 'approve-all' }, () => setPhotos((all) => all!.map((x) => (x.status === 'pending' ? { ...x, status: 'approved' } : x))), 'All pending photos are approved.');

  const count = (s: Status) => photos?.filter((p) => p.status === s).length ?? 0;
  const shown = (photos ?? []).filter((p) => p.status === filter);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-800">Guest uploads are <strong>{enabled ? 'on' : 'off'}</strong>.</p>
        <button type="button" disabled={busy} onClick={toggle} className={ghostBtn} aria-pressed={enabled}>{enabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      <p className="text-sm text-slate-700">Guests can send up to 5 photos at a time, 500 in total. Nothing appears on your invitation until you approve it.</p>
      <div role="group" aria-label="Show photos" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setLimit(PAGE); }}
            className={`min-h-11 rounded-full px-4 text-sm font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${filter === f.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
            {f.label} ({count(f.id)})
          </button>
        ))}
        {filter === 'pending' && count('pending') > 0 && <button type="button" disabled={busy} onClick={approveAll} className={btnCls}>Approve all pending</button>}
      </div>
      {!photos ? <p className="text-sm text-slate-700">Loading…</p> : shown.length === 0 ? <p className="text-sm text-slate-700">No {filter} photos.</p> : (
        <>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, limit).map((p) => (
            <li key={p.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
              <Thumb api={api} id={p.id} alt={`Photo from ${p.guestName}`} />
              <p className="text-sm font-semibold text-slate-900 break-words">{p.guestName}</p>
              <div className="flex flex-wrap gap-2">
                {p.status !== 'approved' && <button type="button" disabled={busy} onClick={() => act(p, 'approve')} className={ghostBtn}>Approve<span className="sr-only"> photo from {p.guestName}</span></button>}
                {p.status !== 'rejected' && <button type="button" disabled={busy} onClick={() => act(p, 'reject')} className={ghostBtn}>Reject<span className="sr-only"> photo from {p.guestName}</span></button>}
                <button type="button" disabled={busy} onClick={() => act(p, 'delete')} className={ghostBtn.replace('text-slate-800', 'text-red-700')}>Delete<span className="sr-only"> photo from {p.guestName}</span></button>
              </div>
            </li>
          ))}
        </ul>
        {shown.length > limit && <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={ghostBtn}>Load more ({shown.length - limit} left)</button>}
        </>
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
