// /designs/<design>/customise: details form + live preview, then Place order → the order page with GCash payment details.
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import InvitationView from './InvitationView';
import { Alert, Field, Link, PaneToggle, PhotoPicker, go, inputCls, peso, useInvitationFonts, useTurnstile } from './kit';
import { orderKey } from './TrackPage';
import { LIMITS } from '../../shared/invitation-fields';
import { formOf } from './forms';
import { restoreDraft, savedFor } from './forms/restore';

import { resolveOrderPackage } from '../../shared/packages';
import { fetchDesigns, type Design } from '../site/designs-api';

export { fetchDesigns, type Design };

// Saved before placing the order so a failed or interrupted attempt keeps the form (photos are too large to keep).
// Every key with this prefix is cleared once the order is placed.
const DRAFT_KEY = 'jlc_inv_draft:';
type Saved = { slug: string; draft: any; scheme: string; email: string; name?: string; phone?: string; hadPhotos: boolean };

export default function CustomiserPage({ slug, btn }: { slug: string; btn: string }) {
  useInvitationFonts();
  const [design, setDesign] = React.useState<Design | null | 'missing' | 'offline'>(null);
  const [saved] = React.useState<Saved | null>(() => { try { return savedFor(JSON.parse(sessionStorage.getItem(DRAFT_KEY + slug) || 'null'), slug); } catch { return null; } });
  const [draft, setDraft] = React.useState<any>(null);
  const [scheme, setScheme] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [email, setEmail] = React.useState(saved?.email ?? '');
  const [name, setName] = React.useState(saved?.name ?? '');
  const [phone, setPhone] = React.useState(saved?.phone ?? '');
  const [notes, setNotes] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');
  const turnstile = useTurnstile();

  React.useEffect(() => {
    let alive = true;
    fetchDesigns()
      .then((all) => {
        if (!alive) return;
        const d = all.find((x) => x.slug === slug);
        setDesign(d ?? 'missing');
        if (d) document.title = `Customise ${d.name} | JLC Solutions`;
        if (d) setDraft((cur: any) => cur ?? (formOf(d.productType) ? restoreDraft(saved, slug, formOf(d.productType)!) : null));
        if (d) setScheme(d.colorSchemes.some((s) => s.name === saved?.scheme) ? saved!.scheme : d.colorSchemes[0]?.name ?? '');
      })
      .catch(() => { if (alive) setDesign('offline'); });
    return () => { alive = false; };
  }, [slug]);

  if (design === null) return <p className="py-24 text-center text-sm text-slate-500">Loading design…</p>;
  if (design === 'missing' || design === 'offline') {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <p className="text-slate-700">{design === 'missing' ? "That design isn't available." : 'We could not load this design. Please check your connection and reload.'}</p>
        <Link href="/designs" className="text-sm font-bold text-slate-900 underline">See all designs</Link>
      </div>
    );
  }

  const form = formOf(design.productType);
  if (!form || !draft) return <p className="py-24 px-4 text-center text-sm text-slate-600">This design can't be customised online yet. Please contact us.</p>;
  const chosen = design.colorSchemes.find((s) => s.name === scheme) ?? design.colorSchemes[0];
  const pkg = resolveOrderPackage(design.packages, new URLSearchParams(window.location.search).get('package') ?? undefined);
  if (!pkg) return <p className="py-24 px-4 text-center text-sm text-slate-600">This design can't be ordered online yet. Please contact us.</p>;
  const check = form.check(draft);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (check.ok === false) return setError(`Please fix this first: ${check.error}.`);
    if (pkg!.kind === 'custom' && !notes.trim()) return setError('Please add notes for the designer.');
    if (!name.trim()) return setError('Please enter your name.');
    if (!terms) return setError('Please agree to the Terms, Refund Policy and Privacy Notice.');
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setPaying(true);
    setError('');
    try { sessionStorage.setItem(DRAFT_KEY + slug, JSON.stringify({ slug, draft, scheme: chosen?.name ?? '', email, name, phone, hadPhotos: photos.length > 0 } satisfies Saved)); } catch { /* private mode: nothing restored */ }
    try {
      const res = await fetch('/api/invitations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designSlug: slug, packageKey: pkg.key, colorScheme: chosen?.name, details: draft, photos, email, name, phone, ...(pkg!.kind === 'custom' ? { designerNotes: notes.trim() } : {}), termsAccepted: true, turnstileToken: turnstile.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reference) {
        try {
          for (const k of Object.keys(sessionStorage)) if (k.startsWith(DRAFT_KEY)) sessionStorage.removeItem(k);
          sessionStorage.setItem(orderKey(data.reference), data.trackingToken);
        } catch { /* private mode: the order email has the tracking link */ }
        go('/order/' + data.reference);
        return;
      }
      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    }
    turnstile.reset();
    setPaying(false);
  }

  return (
    <div className="bg-slate-50 select-text">
      <PaneToggle view={view} setView={setView} />
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:px-8 lg:py-8">
        <form onSubmit={pay} noValidate className={`${view === 'edit' ? 'block' : 'hidden'} lg:block bg-white lg:rounded-3xl lg:border lg:border-slate-200 p-5 sm:p-8 space-y-6`}>
          <div className="space-y-1">
            <Link href={`/designs/${encodeURIComponent(slug)}`} className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to design
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">{design.name}</h1>
            <p className="text-sm text-slate-600">Package: {pkg.name} — {peso(pkg.priceCentavos)} · one-time payment · your invitation stays online until 60 days after the event</p>
          </div>

          {design.colorSchemes.length > 1 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-extrabold text-slate-900 font-display">Colors</legend>
              <div className="flex flex-wrap gap-3">
                {design.colorSchemes.map((s) => (
                  <button key={s.name} type="button" onClick={() => setScheme(s.name)} aria-pressed={s.name === chosen?.name}
                    className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer ${s.name === chosen?.name ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
                    <span className="flex -space-x-1.5" aria-hidden="true">
                      {[s.background, s.primary, s.accent].map((c, i) => <span key={i} className="w-5 h-5 rounded-full border border-slate-300" style={{ background: c }} />)}
                    </span>
                    {s.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <form.Form draft={draft} onChange={setDraft} />
          {saved?.hadPhotos && !photos.length && <Alert kind="info">Your details were restored. Please re-add your photos.</Alert>}
          <PhotoPicker photos={photos} onChange={setPhotos} />

          {pkg.kind === 'custom' && (
            <div className="space-y-1 border-t border-slate-200 pt-6">
              <label htmlFor="designer-notes" className="block text-sm font-extrabold text-slate-900 font-display">Notes for the designer *</label>
              <textarea id="designer-notes" rows={5} maxLength={1500} required aria-describedby="designer-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              <p id="designer-notes-hint" className="flex justify-between gap-3 text-xs text-slate-600">
                <span>Tell us your ideas: colours, style, wording, anything we should know.</span><span>{notes.length}/1500</span>
              </p>
            </div>
          )}

          <fieldset className="space-y-4 border-t border-slate-200 pt-6">
            <legend className="text-sm font-extrabold text-slate-900 font-display pr-3">Checkout</legend>
            <Field label="Your name *">
              <input className={inputCls} autoComplete="name" required maxLength={LIMITS.customerName} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Your email *" hint="We'll send your order updates, guest link and private manage link here.">
              <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Mobile number (optional)">
              <input className={inputCls} type="tel" autoComplete="tel" maxLength={LIMITS.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
              <span>
                I agree to the <a className="underline font-semibold" href="/terms" target="_blank" rel="noopener">Terms</a>,{' '}
                <a className="underline font-semibold" href="/refund-policy" target="_blank" rel="noopener">Refund Policy</a> and{' '}
                <a className="underline font-semibold" href="/privacy" target="_blank" rel="noopener">Privacy Notice</a>
                <span className="sr-only"> (open in new tabs)</span>
              </span>
            </label>
            <div ref={turnstile.ref} className="min-h-[65px]" />
            {turnstile.error && <p role="alert" className="text-xs text-red-600">{turnstile.error}</p>}
            {check.ok === false && !error && <p className="text-xs text-amber-700">Still needed: {check.error}.</p>}
            {error && <Alert>{error}</Alert>}
            <button type="submit" disabled={paying}
              className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer disabled:opacity-60 ${btn}`}>
              {paying ? 'Placing order…' : `Place order · ${peso(pkg.priceCentavos)}`}
            </button>
            <p className="text-[11px] text-slate-500 text-center">Next you'll see the GCash details. Pay, then upload your receipt; we confirm your payment before starting your invitation.</p>
          </fieldset>
        </form>

        <section aria-label="Live preview" className={`${view === 'preview' ? 'block' : 'hidden'} lg:block`}>
          <div className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm bg-white">
            {chosen && <InvitationView layoutKey={design.layoutKey} scheme={chosen} details={form.preview(draft, form.toDraft(design.sampleDetails))} photos={photos} style={{}} />}
          </div>
        </section>
      </div>
    </div>
  );
}
