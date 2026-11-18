// Invitations & RSVPs (#/invitations): every invitation with its guest RSVPs, plus the Event features panel for content.manage.
import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner } from '../ui';
import { can } from '../../server/permissions';
import type { Session } from './api';
import InvitationFeatures from './InvitationFeatures';

type Invitation = { id: number; slug: string; status: string; title: string; design_name: string; event_date: string | null; rsvpCount: number };
type Rsvp = { guestName: string; attending: boolean; partySize: number; kidsCount?: number; message: string; submitted: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const attendance = (r: Rsvp) => !r.attending ? 'not attending'
  : r.kidsCount ? `attending, ${plural(r.partySize, 'adult', 'adults')} + ${plural(r.kidsCount, 'kid', 'kids')}` : `attending, party of ${r.partySize}`;

export default function InvitationsPage({ session }: { session: Session }) {
  const [list, setList] = useState<Invitation[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[] | null>(null);

  const load = () => {
    setError('');
    session.api<{ invitations: Invitation[] }>('/api/admin/invitations/overview').then((d) => setList(d.invitations)).catch((e: Error) => setError(e.message));
  };
  useEffect(load, [session]);

  async function toggle(id: number) {
    if (open === id) return setOpen(null);
    setOpen(id);
    setRsvps(null);
    try {
      const d = await session.api<{ rsvps: Rsvp[] }>(`/api/admin/invitations/invitations/${id}/rsvps`);
      setRsvps(d.rsvps);
    } catch (e) {
      setError((e as Error).message);
      setOpen(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Invitations</h1>
        <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!list && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading invitations…</p>}
      {list && (list.length === 0 ? <div className="mt-6"><EmptyState title="No invitations yet" /></div> : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-card border border-slate-200 bg-white">
          {list.map((i) => (
            <li key={i.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/i/${i.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-800 hover:underline">/i/{i.slug}</a>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">{i.status}</span>
                  <span className="text-sm font-semibold">{i.title}</span>
                  <span className="text-xs text-slate-600">{i.design_name} · {i.event_date || 'no date'}</span>
                </div>
                <Button variant="secondary" size="sm" aria-expanded={open === i.id} onClick={() => toggle(i.id)}>
                  {open === i.id ? 'Hide RSVPs' : `View RSVPs (${i.rsvpCount})`}
                </Button>
              </div>
              {open === i.id && (
                <div className="space-y-1.5 rounded-control bg-slate-50 p-3 text-sm">
                  {!rsvps ? 'Loading…' : rsvps.length === 0 ? 'No RSVPs yet.' : rsvps.map((r, n) => (
                    <div key={n}>
                      <strong>{r.guestName}</strong> · {attendance(r)}
                      {r.message && <span className="text-slate-600"> · “{r.message}”</span>}
                    </div>
                  ))}
                </div>
              )}
              {open === i.id && can(session.user.role, 'content.manage') && <InvitationFeatures session={session} id={i.id} />}
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
