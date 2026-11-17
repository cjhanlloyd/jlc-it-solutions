// Manage page "Guest links": personal links that greet a guest by name and cap their reply at the seats set here.
import React from 'react';
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { LIMITS } from '../../shared/invitation-fields';
import { Alert } from './kit';
import { copyText, focusRing, primaryBtn, secondaryBtn, useCopied } from './LinkBox';
import { copyAllText, guestLink, guestStatus, guestSummary, seatOptions, type GuestRow } from './customer-ui';

type Api = (path: string, init?: RequestInit) => Promise<Response>;
const OFFLINE = 'We could not reach the server. Please check your connection and try again.';
const fieldCls = `w-full rounded-xl border border-gold bg-white px-4 py-2.5 text-base text-ink ${focusRing}`;
const labelCls = 'mb-1.5 block text-sm font-semibold text-ink';
// Row actions: three equal columns on phones (icons from sm up), so a row never wraps its buttons
const rowBtn = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-gold bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-60 cursor-pointer ${focusRing}`;
const SEATS = seatOptions(1, LIMITS.partySizeMax);

const statusCls = (g: GuestRow) => !g.rsvp ? 'bg-white text-ink border-ink/30' : g.rsvp.attending ? 'bg-brand-50 text-brand-800 border-brand-200' : 'bg-sand text-ink border-gold-light';

function SeatsSelect({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  return (
    <select id={id} className={`${fieldCls} sm:w-28`} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {SEATS.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

export default function GuestLinks({ api, slug }: { api: Api; slug: string }) {
  const [guests, setGuests] = React.useState<GuestRow[] | null | 'error'>(null);
  const [name, setName] = React.useState('');
  const [seats, setSeats] = React.useState(2);
  const [editing, setEditing] = React.useState<{ id: number; name: string; seats: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [copied, markCopied] = useCopied();
  const origin = window.location.origin;

  const load = React.useCallback(async () => {
    try {
      const res = await api('/guests');
      setGuests(res.ok ? (await res.json()).guests : 'error');
    } catch { setGuests('error'); }
  }, [api]);
  React.useEffect(() => { load(); }, [load]);

  async function act(body: object, done: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api('/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { await load(); setNotice(done); return true; }
      setError((await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.');
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
    return false;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await act({ action: 'add', name: name.trim(), seats }, `Added ${name.trim()}.`)) setName('');
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editing && await act({ action: 'update', id: editing.id, name: editing.name.trim(), seats: editing.seats }, 'Guest updated.')) setEditing(null);
  }
  function remove(g: GuestRow) {
    if (window.confirm(`Delete ${g.name}'s link? It will show the general invitation instead.`)) act({ action: 'delete', id: g.id }, `Deleted ${g.name}.`);
  }
  async function copy(key: string, text: string, what: string) {
    if (await copyText(text, what)) markCopied(key);
  }

  const list = Array.isArray(guests) ? guests : [];
  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 font-sans text-ink sm:p-8" aria-labelledby="guests-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="guests-h" className="text-lg font-extrabold text-slate-900 font-display">Guest links</h2>
          <p className="mt-1 max-w-prose text-sm text-ink/80">Give each guest their own link. It greets them by name and keeps their reply to the seats you set.</p>
        </div>
        {list.length > 0 && (
          <button type="button" className={secondaryBtn} onClick={() => copy('all', copyAllText(list, origin, slug), 'all guest links')}>
            {copied === 'all' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied === 'all' ? 'Copied' : 'Copy all links'}
          </button>
        )}
      </div>

      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-gold-light bg-ivory p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="guest-name" className={labelCls}>Guest name</label>
          <input id="guest-name" className={fieldCls} required maxLength={80} placeholder="e.g. Tita Rosa & family" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="guest-seats" className={labelCls}>Seats</label>
          <SeatsSelect id="guest-seats" value={seats} onChange={setSeats} />
        </div>
        <button type="submit" disabled={busy || !name.trim()} className={primaryBtn}><Plus className="h-4 w-4" aria-hidden="true" /> Add</button>
      </form>

      {error && <Alert>{error}</Alert>}
      <p className="sr-only" aria-live="polite">{notice}{copied ? ' Copied.' : ''}</p>

      {guests === null && <p role="status" className="text-sm text-ink/80">Loading guests…</p>}
      {guests === 'error' && <p className="text-sm text-ink/80">We could not load your guests. <button type="button" className={`font-semibold text-brand-700 underline ${focusRing}`} onClick={load}>Try again</button></p>}
      {Array.isArray(guests) && (guests.length === 0
        ? <p className="text-sm text-ink/80">No guest links yet. Add your first guest above.</p>
        : (
          <>
            <p className="text-sm font-semibold text-ink">{guestSummary(guests)}</p>
            <ul className="divide-y divide-gold-light border-y border-gold-light">
              {guests.map((g) => (
                <li key={g.id} className="py-4">
                  {editing?.id === g.id ? (
                    <form onSubmit={saveEdit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`edit-name-${g.id}`} className={labelCls}>Name</label>
                        <input id={`edit-name-${g.id}`} className={fieldCls} required maxLength={80} autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor={`edit-seats-${g.id}`} className={labelCls}>Seats</label>
                        <SeatsSelect id={`edit-seats-${g.id}`} value={editing.seats} onChange={(n) => setEditing({ ...editing, seats: n })} />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={busy || !editing.name.trim()} className={primaryBtn}>Save</button>
                        <button type="button" className={secondaryBtn} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-ink">{g.name}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/80">
                          <span>{g.seats} {g.seats === 1 ? 'seat' : 'seats'}</span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusCls(g)}`}>{guestStatus(g)}</span>
                        </p>
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex">
                        <button type="button" className={rowBtn} onClick={() => copy(`g${g.id}`, guestLink(origin, slug, g.token), `${g.name}'s link`)}>
                          {copied === `g${g.id}` ? <Check className="hidden h-4 w-4 sm:block" aria-hidden="true" /> : <Copy className="hidden h-4 w-4 sm:block" aria-hidden="true" />}
                          {copied === `g${g.id}` ? 'Copied' : 'Copy link'}<span className="sr-only"> for {g.name}</span>
                        </button>
                        <button type="button" className={rowBtn} onClick={() => { setError(''); setEditing({ id: g.id, name: g.name, seats: g.seats }); }}>
                          <Pencil className="hidden h-4 w-4 sm:block" aria-hidden="true" /> Edit<span className="sr-only"> {g.name}</span>
                        </button>
                        <button type="button" disabled={busy} className={rowBtn} onClick={() => remove(g)}>
                          <Trash2 className="hidden h-4 w-4 sm:block" aria-hidden="true" /> Delete<span className="sr-only"> {g.name}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ))}
    </section>
  );
}
