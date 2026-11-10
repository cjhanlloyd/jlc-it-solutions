import React from 'react';
import * as Icons from 'lucide-react';
import { adminApi } from './api.js';
import type { AdminTabProps } from './types.js';
import type { InvTabProps } from './InvitationsCommon.js';

type Rsvp = { guestName: string; attending: boolean; partySize: number; kidsCount?: number; message: string; submitted: string };

export default function InvitationsTab({ overview, reload, adminToken, setApiError }: AdminTabProps & InvTabProps) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [rsvps, setRsvps] = React.useState<Rsvp[] | null>(null);

  const toggle = async (id: number) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    setRsvps(null);
    try {
      const data = await adminApi(`/api/admin/invitations/invitations/${id}/rsvps`, adminToken, undefined, 'Failed to load RSVPs.');
      setRsvps(data.rsvps);
    } catch (e: any) {
      setApiError(e.message);
      setOpen(null);
    }
  };

  return (
    <div className="space-y-6" id="panel-invitations">
      <div className="border-b border-gray-100 pb-4 flex justify-between items-start gap-4">
        <h2 className="text-xl font-bold text-gray-900 font-sans">Invitations</h2>
        <button onClick={() => reload()} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">
          <Icons.RefreshCw className="h-3.5 w-3.5 inline mr-1.5" />Refresh
        </button>
      </div>

      {!overview ? <p className="text-xs text-gray-400">Loading...</p> : overview.invitations.length === 0 ? <p className="text-xs text-gray-400">No invitations yet.</p> : (
        <div className="divide-y divide-gray-100">
          {overview.invitations.map((i) => (
            <div key={i.id} className="py-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/i/${i.slug}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">/i/{i.slug}</a>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">{i.status}</span>
                  <span className="text-sm font-semibold text-gray-800">{i.title}</span>
                  <span className="text-xs text-gray-500">{i.design_name} · {i.event_date || 'no date'}</span>
                </div>
                <button onClick={() => toggle(i.id)} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">
                  {open === i.id ? 'Hide RSVPs' : `View RSVPs (${i.rsvpCount})`}
                </button>
              </div>
              {open === i.id && (
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                  {!rsvps ? 'Loading...' : rsvps.length === 0 ? 'No RSVPs yet.' : rsvps.map((r, n) => (
                    <div key={n}>
                      <strong>{r.guestName}</strong> · {r.attending ? r.kidsCount ? `attending, ${r.partySize} ${r.partySize === 1 ? 'adult' : 'adults'} + ${r.kidsCount} ${r.kidsCount === 1 ? 'kid' : 'kids'}` : `attending, party of ${r.partySize}` : 'not attending'}
                      {r.message && <span className="text-gray-500"> · "{r.message}"</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
