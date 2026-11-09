// /manage#<token>: the couple edits their invitation and sees RSVPs. The token lives only in memory and goes in a header.
import React from 'react';
import * as Icons from 'lucide-react';
import InvitationView from './InvitationView';
import { Alert, DetailsForm, Field, PaneToggle, PhotoPicker, checkDraft, inputCls, photoSrc, previewDetails, toDraft, useInvitationFonts, useTurnstile, type Draft } from './kit';
import type { Scheme } from './parts';

type Rsvp = { guestName: string; attending: boolean; partySize: number; message: string; submitted: string };
type Manage = { slug: string; design: { name: string; layoutKey: string }; colorScheme: Scheme; details: Draft; photos: string[]; rsvps: Rsvp[] };

// Read once and drop the fragment from the address bar and history right away.
let memoryToken: string | null = null;
function takeToken(): string {
  if (memoryToken === null) {
    memoryToken = decodeURIComponent(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);
  }
  return memoryToken;
}

function ResendForm({ btn }: { btn: string }) {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = React.useState('');
  const turnstile = useTurnstile();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/invitations/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, turnstileToken: turnstile.token }) });
      if (res.ok) return setState('sent');
      setError((await res.json().catch(() => null))?.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    }
    turnstile.reset();
    setState('idle');
  }
  if (state === 'sent') return <Alert kind="success">If that email has a live invitation, we've sent its links. Check your inbox (and spam folder) in a few minutes. Older manage links stop working.</Alert>;
  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <Field label="Email used at checkout">
        <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <div ref={turnstile.ref} className="min-h-[65px]" />
      {turnstile.error && <p className="text-xs text-red-600">{turnstile.error}</p>}
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={state === 'sending'} className={`w-full px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white cursor-pointer disabled:opacity-60 ${btn}`}>
        {state === 'sending' ? 'Sending…' : 'Email me my links'}
      </button>
    </form>
  );
}

export default function ManagePage({ btn }: { btn: string }) {
  useInvitationFonts();
  const token = takeToken();
  const [data, setData] = React.useState<Manage | null | 'missing' | 'offline'>(token ? null : 'missing');
  const [draft, setDraft] = React.useState<Draft>(() => toDraft());
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');

  const api = (path: string, init?: RequestInit) => fetch(`/api/invitations/manage${path}`, { ...init, headers: { ...init?.headers, 'X-Manage-Token': token } });

  React.useEffect(() => {
    if (!token) return;
    api('').then(async (res) => {
      if (res.status === 404) return setData('missing');
      if (!res.ok) return setData('offline');
      const d: Manage = await res.json();
      setData(d);
      setDraft(toDraft(d.details));
      setPhotos(d.photos);
    }).catch(() => setData('offline'));
  }, []);

  if (data === null) return <p className="py-24 text-center text-sm text-slate-500">Loading your invitation…</p>;
  if (data === 'offline') return <p className="py-24 px-4 text-center text-sm text-slate-600">We could not load your invitation. Please check your connection and open your manage link again.</p>;
  if (data === 'missing') {
    return (
      <div className="bg-slate-50 py-20 px-4 select-text">
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto"><Icons.KeyRound className="h-6 w-6" /></div>
            <h1 className="text-xl font-extrabold text-slate-900 font-display">This manage link doesn't work</h1>
            <p className="text-sm text-slate-600">It may be an older link (each new email replaces the previous one), or the invitation is no longer live. Enter the email you used at checkout and we'll send fresh links.</p>
          </div>
          <ResendForm btn={btn} />
        </div>
      </div>
    );
  }

  const guestUrl = `${window.location.origin}/i/${data.slug}`;
  const check = checkDraft(draft);
  const yes = data.rsvps.filter((r) => r.attending);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (check.ok === false) return setMsg({ kind: 'error', text: `Please fix this first: ${check.error}.` });
    setSaving(true);
    setMsg(null);
    try {
      const res = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ details: draft, photos }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDraft(toDraft(body.details));
        setPhotos(body.photos);
        setMsg({ kind: 'success', text: 'Saved. Your guests see the changes right away.' });
      } else setMsg({ kind: 'error', text: res.status === 404 ? 'This manage link no longer works. Request fresh links from this page after reloading.' : body.error || 'Something went wrong. Please try again.' });
    } catch {
      setMsg({ kind: 'error', text: 'We could not reach the server. Please check your connection and try again.' });
    }
    setSaving(false);
  }

  async function downloadCsv() {
    const res = await api('/rsvps.csv').catch(() => null);
    if (!res?.ok) return setMsg({ kind: 'error', text: 'Could not download the RSVPs. Please try again.' });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `rsvps-${data && typeof data === 'object' ? data.slug : 'invitation'}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(guestUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy your guest link:', guestUrl); }
  }

  return (
    <div className="bg-slate-50 select-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-4">
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Manage your invitation · {data.design.name}</p>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">{data.details.partner1} &amp; {data.details.partner2}</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className={`${inputCls} flex-1`} readOnly value={guestUrl} aria-label="Guest link" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copy} className={`inline-flex items-center justify-center px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white cursor-pointer ${btn}`}>
              <Icons.Copy className="h-4 w-4 mr-1.5" /> {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a href={guestUrl} target="_blank" rel="noopener" className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-slate-300 text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:bg-slate-100">
              Open <Icons.ExternalLink className="h-4 w-4 ml-1.5" />
            </a>
          </div>
          <p className="text-xs text-slate-500">Share the guest link. Keep this manage page's link private: anyone with it can edit your invitation.</p>
        </div>

        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-4" aria-labelledby="rsvp-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="rsvp-h" className="text-lg font-extrabold text-slate-900 font-display">
              RSVPs <span className="text-sm font-normal text-slate-500">· {yes.length} attending ({yes.reduce((n, r) => n + r.partySize, 0)} guests) · {data.rsvps.length - yes.length} declined</span>
            </h2>
            <button type="button" onClick={downloadCsv} disabled={!data.rsvps.length} className="inline-flex items-center px-4 py-2 rounded-full border border-slate-300 text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50">
              <Icons.Download className="h-4 w-4 mr-1.5" /> Download CSV
            </button>
          </div>
          {data.rsvps.length === 0 ? <p className="text-sm text-slate-500">No RSVPs yet. They'll appear here as guests respond.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                  <tr><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Attending</th><th className="py-2 pr-4">Party</th><th className="py-2 pr-4">Message</th><th className="py-2">Received</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rsvps.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-2 pr-4 font-semibold text-slate-900">{r.guestName}</td>
                      <td className="py-2 pr-4">{r.attending ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4">{r.attending ? r.partySize : '–'}</td>
                      <td className="py-2 pr-4 text-slate-600 whitespace-pre-line min-w-48">{r.message}</td>
                      <td className="py-2 text-slate-500 whitespace-nowrap">{new Date(r.submitted).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <PaneToggle view={view} setView={setView} />
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:px-8 lg:pb-8">
        <form onSubmit={save} noValidate className={`${view === 'edit' ? 'block' : 'hidden'} lg:block bg-white lg:rounded-3xl lg:border lg:border-slate-200 p-5 sm:p-8 space-y-6`}>
          <h2 className="text-lg font-extrabold text-slate-900 font-display">Edit details</h2>
          <DetailsForm draft={draft} onChange={setDraft} lockNames />
          <PhotoPicker photos={photos} onChange={setPhotos} />
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <button type="submit" disabled={saving} className={`w-full px-6 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer disabled:opacity-60 ${btn}`}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
        <section aria-label="Live preview" className={`${view === 'preview' ? 'block' : 'hidden'} lg:block`}>
          <div className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-slate-200 bg-white">
            <InvitationView layoutKey={data.design.layoutKey} scheme={data.colorScheme} details={previewDetails(draft, toDraft(data.details))} photos={photos.map(photoSrc)} />
          </div>
        </section>
      </div>
    </div>
  );
}
