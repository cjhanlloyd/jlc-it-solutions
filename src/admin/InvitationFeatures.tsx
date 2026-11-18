// Admin → Invitations: the per-invitation "Event features" panel (content.manage). Features in use, check-in totals,
// wish list reservations (read-only) and guest photo moderation, a backstop to the organiser.
import { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '../ui';
import { fmtManila, type Session } from './api';

type Status = 'pending' | 'approved' | 'rejected';
type Photo = { id: number; guestName: string; status: Status; createdAt: string };
type Features = {
  tier: string;
  inUse: { attire: boolean; galleryLayout: string; giftItems: number; giftMethods: number; guestPhotos: boolean; booth: boolean; checkin: boolean };
  checkin: { guests: number; checkedIn: number; people: number };
  reservations: { item: string; name: string; at: string }[];
  photos: Photo[];
};

// Fetched only once it scrolls into view; data: URLs need no revoking.
const PAGE = 24;
function Thumb({ session, path, alt }: { session: Session; path: string; alt: string }) {
  const [src, setSrc] = useState('');
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    let live = true;
    session.image(path).then((u) => { if (live) setSrc(u); }, () => {});
    return () => { live = false; };
  }, [session, path, seen]);
  return src ? <img src={src} alt={alt} className="h-28 w-full rounded-control object-cover" /> : <div ref={box} role="img" aria-label={`${alt} (loading)`} className="h-28 w-full rounded-control bg-slate-200" />;
}

const onOff = (b: boolean) => (b ? 'on' : 'off');

export default function InvitationFeatures({ session, id }: { session: Session; id: number }) {
  const [data, setData] = useState<Features | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Status>('pending');
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const base = `/api/admin/invitations/invitations/${id}`;

  useEffect(() => {
    session.api<Features>(`${base}/features`).then(setData).catch((e: Error) => setError(e.message));
  }, [session, base]);

  async function act(body: { action: string; id?: number }) {
    setBusy(true); setError('');
    try {
      await session.api(`${base}/guest-photos`, body);
      setData((d) => d && {
        ...d, photos: body.action === 'delete' ? d.photos.filter((p) => p.id !== body.id)
          : d.photos.map((p) => (body.action === 'approve-all' ? p.status === 'pending' : p.id === body.id)
            ? { ...p, status: body.action === 'reject' ? 'rejected' : 'approved' } : p),
      });
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (!data) return <div className="rounded-control bg-slate-50 p-3 text-sm">{error ? <p role="alert" className="text-red-700">{error}</p> : <span className="flex items-center gap-2"><Spinner /> Loading event features…</span>}</div>;
  const u = data.inUse;
  const count = (s: Status) => data.photos.filter((p) => p.status === s).length;
  const shown = data.photos.filter((p) => p.status === filter);
  return (
    <section aria-label="Event features" className="space-y-4 rounded-control bg-slate-50 p-3 text-sm">
      <div>
        <h3 className="font-semibold">Event features ({data.tier})</h3>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
          <li>Attire: {onOff(u.attire)}</li>
          <li>Gallery: {u.galleryLayout}</li>
          <li>Gifts: {u.giftItems} wish list, {u.giftMethods} cash</li>
          <li>Guest photos: {onOff(u.guestPhotos)}</li>
          <li>Photo booth: {onOff(u.booth)}</li>
          <li>Check-in: {onOff(u.checkin)}</li>
        </ul>
      </div>
      <p><span className="font-semibold">Check-in:</span> {data.checkin.checkedIn} of {data.checkin.guests} guests, {data.checkin.people} people</p>
      <div>
        <h3 className="font-semibold">Wish list reservations</h3>
        {data.reservations.length === 0 ? <p className="text-slate-700">None yet.</p> : (
          <ul className="mt-1 space-y-0.5">{data.reservations.map((r, i) => <li key={i}><strong>{r.item}</strong> · {r.name} · {fmtManila(r.at)}</li>)}</ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Guest photos</h3>
        <div role="group" aria-label="Show guest photos" className="flex flex-wrap gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <Button key={s} size="sm" variant={filter === s ? 'primary' : 'secondary'} aria-pressed={filter === s} onClick={() => { setFilter(s); setLimit(PAGE); }}>{s[0].toUpperCase() + s.slice(1)} ({count(s)})</Button>
          ))}
          {filter === 'pending' && count('pending') > 0 && <Button size="sm" disabled={busy} onClick={() => act({ action: 'approve-all' })}>Approve all pending</Button>}
        </div>
        {shown.length === 0 ? <p className="text-slate-700">No {filter} photos.</p> : (
          <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shown.slice(0, limit).map((p) => (
              <li key={p.id} className="space-y-1.5 rounded-control border border-slate-200 bg-white p-2">
                <Thumb session={session} path={`${base}/media/${p.id}`} alt={`Photo from ${p.guestName}`} />
                <p className="break-words font-semibold">{p.guestName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.status !== 'approved' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ action: 'approve', id: p.id })}>Approve<span className="sr-only"> photo from {p.guestName}</span></Button>}
                  {p.status !== 'rejected' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ action: 'reject', id: p.id })}>Reject<span className="sr-only"> photo from {p.guestName}</span></Button>}
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => act({ action: 'delete', id: p.id })}>Delete<span className="sr-only"> photo from {p.guestName}</span></Button>
                </div>
              </li>
            ))}
          </ul>
          {shown.length > limit && <Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>Load more ({shown.length - limit} left)</Button>}
          </>
        )}
      </div>
      {error && <p role="alert" className="font-medium text-red-700">{error}</p>}
    </section>
  );
}
