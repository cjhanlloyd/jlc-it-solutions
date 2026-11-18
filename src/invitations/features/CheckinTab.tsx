// Manage page "Check-in" (Premium): switch QR check-in on, set up a door phone, and watch guests arrive (refreshes every 5 seconds).
import React from 'react';
import type { Extras } from '../../../shared/extras';
import { Alert } from '../kit';
import QrCode from '../QrCode';
import { btnCls, ghostBtn, OFFLINE, postJson, type Api } from './shared';

type Guest = { id: number; name: string; seats: number; rsvp: 'attending' | 'declined' | null; party: number; checkedInAt: string | null; checkedInCount: number };
type Totals = { attendingGuests: number; checkedInGuests: number; expectedPeople: number; checkedInPeople: number };
type Data = { enabled: boolean; hasKey: boolean; guests: Guest[]; totals: Totals };

const manila = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export default function CheckinTab({ api, extras, onExtras, active }: { api: Api; extras: Extras; onExtras: (e: Extras) => void; active: boolean }) {
  const [data, setData] = React.useState<Data | null>(null);
  const [search, setSearch] = React.useState('');
  const [door, setDoor] = React.useState<string | null>(null); // the door link, known only right after it is created
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const enabled = extras.checkin?.enabled === true;

  const load = React.useCallback(() => {
    api('/checkin').then((r) => (r.ok ? r.json() : Promise.reject())).then(setData, () => {});
  }, [api]);
  React.useEffect(() => {
    if (!active) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5000);
    return () => clearInterval(t);
  }, [active, load, enabled]);

  async function run(path: string, body: unknown, ok: (b: any) => void, done?: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await postJson(api, path, body);
      const b = await res.json().catch(() => ({}));
      if (res.ok) { ok(b); if (done) setMsg({ kind: 'success', text: done }); } else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
  }
  const toggle = () => run('/extras', { extras: { ...extras, checkin: { enabled: !enabled } } }, (b) => onExtras(b.extras), enabled ? 'Check-in is off.' : 'Check-in is on. Attending guests with a guest link now see an entry pass.');
  const makeKey = () => run('/checkin/key', {}, (b) => { setDoor(`${window.location.origin}/checkin#${b.invitationId}.${b.key}`); load(); });
  const revoke = () => run('/checkin/key/revoke', {}, () => { setDoor(null); load(); }, 'Door phone access is revoked. Phones that were set up no longer work.');
  const mark = (g: Guest, undo: boolean) => run('/checkin/mark', { guestId: g.id, undo }, load);

  function exportCsv() {
    const rows = [['Name', 'Seats', 'RSVP', 'Checked in at'], ...(data?.guests ?? []).map((g) => [g.name, g.seats, g.rsvp ?? 'No reply', g.checkedInAt ?? ''])];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'check-in.csv' }).click();
    URL.revokeObjectURL(url);
  }

  const shown = (data?.guests ?? []).filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));
  const t = data?.totals;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-800">QR check-in is <strong>{enabled ? 'on' : 'off'}</strong>.</p>
        <button type="button" disabled={busy} onClick={toggle} className={ghostBtn} aria-pressed={enabled}>{enabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      <p className="text-sm text-slate-700">Guests who reply "attending" through their own guest link get an entry pass with a QR code. Staff scan it at the door to check them in.</p>

      <section aria-labelledby="door-h" className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h3 id="door-h" className="text-base font-bold text-slate-900">Door phone</h3>
        {door ? (
          <>
            <p className="text-sm text-slate-800">Open this link on the staff phone, or scan the code with it. This is the only time it is shown.</p>
            <div className="flex justify-center"><QrCode text={door} label="Door phone setup QR code" /></div>
            <p className="break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-900 select-all">{door}</p>
            <Alert kind="info">Keep this private. Anyone with it can check guests in. You can revoke it at any time.</Alert>
          </>
        ) : data?.hasKey ? <p className="text-sm text-slate-800">A door phone is set up. Regenerate to show a new link and code; phones set up before stop working.</p>
          : <p className="text-sm text-slate-800">Set up a staff phone to check guests in at the door.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !enabled} onClick={makeKey} className={btnCls}>{data?.hasKey ? 'Regenerate' : 'Set up a door phone'}</button>
          {data?.hasKey && <button type="button" disabled={busy} onClick={revoke} className={ghostBtn}>Revoke</button>}
        </div>
        {!enabled && <p className="text-sm text-slate-700">Turn check-in on first.</p>}
      </section>

      <section aria-labelledby="mon-h" className="space-y-3">
        <h3 id="mon-h" className="text-base font-bold text-slate-900">Arrivals</h3>
        {t && (
          <p className="text-sm text-slate-900" aria-live="polite">
            <strong>{t.checkedInGuests}</strong> of {t.attendingGuests} attending guests checked in · <strong>{t.checkedInPeople}</strong> of {t.expectedPeople} people
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="checkin-search" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Search guests</label>
            <input id="checkin-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900" />
          </div>
          <button type="button" onClick={exportCsv} disabled={!data?.guests.length} className={ghostBtn}>Export CSV</button>
        </div>
        {!data ? <p className="text-sm text-slate-700">Loading…</p> : shown.length === 0 ? <p className="text-sm text-slate-700">{data.guests.length ? 'No guests match.' : 'Add guests with guest links to see them here.'}</p> : (
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {shown.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-900">{g.name}</p>
                  <p className="text-sm text-slate-700">
                    Party of {g.party} · {g.checkedInAt ? `Checked in at ${manila(g.checkedInAt)}` : g.rsvp === 'attending' ? 'Not here yet' : g.rsvp === 'declined' ? 'Declined' : 'No reply'}
                  </p>
                </div>
                {g.checkedInAt
                  ? <button type="button" disabled={busy} onClick={() => mark(g, true)} className={ghostBtn}>Undo<span className="sr-only"> check-in for {g.name}</span></button>
                  : <button type="button" disabled={busy} onClick={() => mark(g, false)} className={ghostBtn}>Check in<span className="sr-only"> {g.name}</span></button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
