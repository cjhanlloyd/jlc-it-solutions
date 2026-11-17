// /designs/<design>/customise: the studio (details, design, photos & cover) with a live preview, then Review & checkout
// → the order page with the payment QR code.
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import InvitationView from './InvitationView';
import { Alert, Field, Link, PaneToggle, go, inputCls, peso, useInvitationFonts, useTurnstile } from './kit';
import { orderKey } from './TrackPage';
import { LIMITS } from '../../shared/invitation-fields';
import { occasionOf } from '../../shared/occasions';
import { formOf } from './forms';
import { restoreDraft } from './forms/restore';
import { effectiveScheme } from './style-render';
import type { InvitationStyle } from '../../shared/invitation-style';
import { draftEntries, parseDraft } from './studio/draft';
import { reviewRows, switchTo } from './studio/review';
import StudioTabs, { type StudioTab } from './studio/StudioTabs';
import DesignTab from './studio/DesignTab';
import PhotosTab from './studio/PhotosTab';
import GiftQrField from './studio/GiftQrField';
import AttireFields, { cleanAttire, type Attire } from './features/AttireFields';
import { useTracks } from './studio/PremiumExtras';
import { forTier, photoLimit, tierOf } from '../../shared/tiers';
import PreviewFrame from './studio/PreviewFrame';

import { resolveOrderPackage } from '../../shared/packages';
import { fetchDesigns, type Design } from '../site/designs-api';

export { fetchDesigns, type Design };

// The studio autosaves here so a refresh or failed attempt keeps the work (photos are too large to keep).
// Every key with this prefix is cleared once the order is placed.
const DRAFT_KEY = 'jlc_inv_draft:';
type AppliedPromo = { code: string; discountCentavos: number; totalCentavos: number; subtotalCentavos: number; label: string };
async function checkPromo(code: string, designSlug: string, packageKey: string): Promise<AppliedPromo> {
  let res: Response;
  try {
    res = await fetch('/api/invitations/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, designSlug, packageKey }) });
  } catch { throw new Error('We could not reach the server. Please try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'We could not check that code. Please try again.');
  return data;
}
const TAB_NAMES = { details: 'Details', design: 'Design', photos: 'Photos & cover' };

// Switching designs only replaces the URL (no popstate), so App keeps this page mounted and the studio state lives on;
// `slug` is the design the page opened with, `cur` the one shown now.
export default function CustomiserPage({ slug, btn }: { slug: string; btn: string }) {
  useInvitationFonts();
  const [designs, setDesigns] = React.useState<Design[] | null | 'offline'>(null);
  const [cur, setCur] = React.useState(slug);
  const [packageKey, setPackageKey] = React.useState(() => new URLSearchParams(window.location.search).get('package') ?? undefined);
  const [saved] = React.useState(() => { try { return parseDraft(sessionStorage.getItem(DRAFT_KEY + slug), slug); } catch { return null; } });
  const [draft, setDraft] = React.useState<any>(null);
  const [scheme, setScheme] = React.useState('');
  const [style, setStyle] = React.useState<InvitationStyle>(saved?.style ?? {});
  const [tab, setTab] = React.useState<StudioTab>('details');
  const [review, setReview] = React.useState(false);
  const [reviewed, setReviewed] = React.useState(false); // the review step stays mounted once shown, so Turnstile keeps its token
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [attire, setAttire] = React.useState<Attire>(saved?.attire ?? {}); // attire motif, palette and notes; sent as extras
  const [giftQr, setGiftQr] = React.useState<string | null>(null); // never autosaved, like photos
  const [awaitPhotos, setAwaitPhotos] = React.useState(!!saved?.hadPhotos);
  const [email, setEmail] = React.useState(saved?.email ?? '');
  const [name, setName] = React.useState(saved?.name ?? '');
  const [phone, setPhone] = React.useState(saved?.phone ?? '');
  const [notes, setNotes] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');
  const [promoInput, setPromoInput] = React.useState('');
  const [promo, setPromo] = React.useState<AppliedPromo | null>(null);
  const [promoMsg, setPromoMsg] = React.useState('');
  const [promoBusy, setPromoBusy] = React.useState(false);
  const turnstile = useTurnstile();
  const pkgNow = Array.isArray(designs) ? resolveOrderPackage(designs.find((x) => x.slug === cur)?.packages ?? [], packageKey) : null;
  const tierNow = tierOf(pkgNow);
  const tracks = useTracks(tierNow === 'premium'); // lazily, once, only for Premium
  const visited = React.useRef([slug]); // every design shown here; each keeps the latest draft (state is per occasion)
  const focusNext = React.useRef<string | null>(null); // element to focus after the next render (entering or leaving Review)
  const saveDraft = (state: Parameters<typeof draftEntries>[2]) => {
    try { for (const [k, v] of draftEntries(DRAFT_KEY, visited.current, state)) sessionStorage.setItem(k, v); } catch { /* private mode: nothing restored */ }
  };

  React.useEffect(() => {
    let alive = true;
    fetchDesigns()
      .then((all) => {
        if (!alive) return;
        setDesigns(all);
        const d = all.find((x) => x.slug === slug);
        if (d) document.title = `Customise ${d.name} | JLC Solutions`;
        if (d) setDraft((c: any) => c ?? (formOf(d.productType) ? restoreDraft(saved, slug, formOf(d.productType)!) : null));
        const keep = saved && (d?.colorSchemes.some((s) => s.name === saved.scheme) || (saved.scheme === 'Custom' && saved.style.colors));
        if (d) setScheme(keep ? saved!.scheme : d.colorSchemes[0]?.name ?? '');
      })
      .catch(() => { if (alive) setDesigns('offline'); });
    return () => { alive = false; };
  }, [slug]);

  React.useEffect(() => { if (photos.length) setAwaitPhotos(false); }, [photos.length > 0]);

  React.useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      saveDraft({ draft, scheme, style, email, name, phone, photos, hadPhotos: awaitPhotos, attire });
    }, 500);
    return () => clearTimeout(t);
  }, [cur, draft, scheme, style, email, name, phone, photos.length > 0, awaitPhotos, attire]);

  // A discount belongs to one design and package: check it again when either changes, or drop it with a note
  const promoRef = React.useRef(promo);
  promoRef.current = promo;
  React.useEffect(() => {
    const p = promoRef.current;
    if (!p || !pkgNow) return;
    let alive = true;
    checkPromo(p.code, cur, pkgNow.key)
      .then((r) => { if (alive) setPromo(r); })
      .catch((e: Error) => { if (alive) { setPromo(null); setPromoMsg(`${p.code} was removed: ${e.message}`); } });
    return () => { alive = false; };
  }, [cur, pkgNow?.key]);

  React.useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  if (designs === null) return <p className="py-24 text-center text-sm text-slate-500">Loading design…</p>;
  const design = designs === 'offline' ? 'offline' : designs.find((x) => x.slug === cur) ?? 'missing';
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
  const base = design.colorSchemes.find((s) => s.name === scheme) ?? design.colorSchemes[0];
  // 'Custom' renders from style.colors (InvitationView derives the rest).
  const chosen = scheme === 'Custom' && style.colors && base ? { ...base, name: 'Custom' } : base;
  const pkg = resolveOrderPackage(design.packages, packageKey);
  if (!pkg) return <p className="py-24 px-4 text-center text-sm text-slate-600">This design can't be ordered online yet. Please contact us.</p>;
  const tier = tierOf(pkg);
  const limit = photoLimit(tier);
  const out = forTier(style, tier); // a Standard design never sends Premium extras, even if picked on a Premium one before switching
  const check = form.check(draft);
  const siblings = (designs as Design[]).filter((d) => d.productType === design.productType);

  const switchDesign = (d: Design) => {
    const next = switchTo(d, { packageKey: pkg.key, scheme: chosen?.name ?? '', style });
    window.history.replaceState(window.history.state, '', next.url);
    if (!visited.current.includes(d.slug)) visited.current.push(d.slug);
    setCur(d.slug);
    setPackageKey(next.packageKey);
    setScheme(next.scheme);
    document.title = `Customise ${d.name} | JLC Solutions`;
  };

  // Details (and designer notes) must be valid before Review; any problem sends the customer to the Details tab.
  const detailsProblem = () =>
    check.ok === false ? `Please fix this first: ${check.error}.` : pkg.kind === 'custom' && !notes.trim() ? 'Please add notes for the designer.' : '';
  const photosProblem = () => (photos.length > limit ? `Standard designs take up to ${limit} photos: remove ${photos.length - limit} to continue.` : '');
  const toPhotos = (msg: string) => { focusNext.current = 'studio-photos'; setReview(false); setTab('photos'); setView('edit'); setError(msg); window.scrollTo({ top: 0 }); };
  const toDetails = (msg: string) => { focusNext.current = 'studio-details'; setReview(false); setTab('details'); setView('edit'); setError(msg); window.scrollTo({ top: 0 }); };
  const enterReview = () => {
    const p = detailsProblem();
    if (p) return toDetails(p);
    if (photosProblem()) return toPhotos(photosProblem());
    setError('');
    focusNext.current = 'review-heading';
    setReview(true);
    setReviewed(true);
    window.scrollTo({ top: 0 });
  };
  const edit = (t: StudioTab) => { focusNext.current = `studio-${t}`; setReview(false); setTab(t); setError(''); window.scrollTo({ top: 0 }); };

  async function applyPromo() {
    if (!promoInput.trim()) return setPromoMsg('Enter a promo code.');
    setPromoBusy(true);
    setPromoMsg('');
    try {
      setPromo(await checkPromo(promoInput, cur, pkg!.key));
      setPromoInput('');
    } catch (e) {
      setPromoMsg((e as Error).message);
    }
    setPromoBusy(false);
  }
  const removePromo = () => { setPromo(null); setPromoMsg(''); };
  const total = promo ? promo.totalCentavos : pkg!.priceCentavos;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!review) return enterReview();
    const p = detailsProblem();
    if (p) return toDetails(p);
    if (photosProblem()) return toPhotos(photosProblem());
    if (!name.trim()) return setError('Please enter your name.');
    if (!terms) return setError('Please agree to the Terms, Refund Policy and Privacy Notice.');
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setPaying(true);
    setError('');
    saveDraft({ draft, scheme: chosen?.name ?? '', style, email, name, phone, photos, hadPhotos: awaitPhotos });
    try {
      const res = await fetch('/api/invitations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designSlug: cur, packageKey: pkg!.key, colorScheme: chosen?.name, style: out, details: draft, photos, ...(giftQr ? { giftQr } : {}), ...(cleanAttire(attire) ? { extras: { attire: cleanAttire(attire) } } : {}), email, name, phone, ...(pkg!.kind === 'custom' ? { designerNotes: notes.trim() } : {}), ...(promo ? { promoCode: promo.code } : {}), termsAccepted: true, turnstileToken: turnstile.token }),
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
      if (promo && /promo code/i.test(data.error ?? '')) { setPromo(null); setPromoMsg(data.error); } // shown on the promo field
      else setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    }
    turnstile.reset();
    setPaying(false);
  }

  const details = check.ok ? check.details : null;
  const rows = details ? reviewRows({
    design: design.name, pkg, price: peso(pkg.priceCentavos), scheme: chosen?.name ?? '', style: out, photos: photos.length, tier, trackTitle: Array.isArray(tracks) ? tracks.find((t) => t.id === out.music)?.title : undefined,
    title: occasionOf(design.productType)?.title(details) ?? '', date: details.eventDate ?? '', venue: (details.ceremony ?? details.venue)?.name ?? '', notes: notes.trim(),
  }) : [];
  const submitCls = `w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer disabled:opacity-60 ${btn}`;

  return (
    <div className="bg-slate-50 select-text">
      <PaneToggle view={view} setView={setView} />
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:px-8 lg:py-8">
        <form onSubmit={pay} noValidate className={`${view === 'edit' ? 'block' : 'hidden'} lg:block min-w-0 bg-white lg:rounded-3xl lg:border lg:border-slate-200 p-5 sm:p-8 space-y-6`}>
          <div className="space-y-1">
            <Link href={`/designs/${encodeURIComponent(cur)}`} className="inline-flex items-center text-xs font-bold text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to design
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">{design.name}</h1>
            <p className="text-sm text-slate-600">Package: {pkg.name} — {peso(pkg.priceCentavos)} · one-time payment · your invitation stays online until {tier === 'premium' ? '6 months' : '60 days'} after the event</p>
          </div>

          <div hidden={review} className="space-y-6">
            {awaitPhotos && <Alert kind="info">Your details were restored. Please re-add your photos.</Alert>}
            <StudioTabs tab={tab} setTab={(t) => { setTab(t); setError(''); }} />
            {!review && error && <Alert>{error}</Alert>}
            <div id="studio-details" tabIndex={-1} role="region" aria-label={TAB_NAMES.details} className="focus:outline-none space-y-6" hidden={tab !== 'details'}>
              <form.Form draft={draft} onChange={setDraft} />
              <GiftQrField value={giftQr} onChange={setGiftQr} />
              <section aria-labelledby="studio-attire-h" className="space-y-3 border-t border-slate-200 pt-6">
                <h3 id="studio-attire-h" className="text-sm font-extrabold text-slate-900 font-display">Attire and motif (optional)</h3>
                <p className="text-xs text-slate-600">Tell guests what to wear. You can add sample photos after your invitation is live.</p>
                <AttireFields value={attire} onChange={setAttire} idPrefix="studio-attire" />
              </section>
              {pkg.kind === 'custom' && (
                <div className="space-y-1 border-t border-slate-200 pt-6">
                  <label htmlFor="designer-notes" className="block text-sm font-extrabold text-slate-900 font-display">Notes for the designer *</label>
                  <textarea id="designer-notes" rows={5} maxLength={1500} required aria-describedby="designer-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                  <p id="designer-notes-hint" className="flex justify-between gap-3 text-xs text-slate-600">
                    <span>Tell us your ideas: colours, style, wording, anything we should know.</span><span>{notes.length}/1500</span>
                  </p>
                </div>
              )}
            </div>
            <div id="studio-design" tabIndex={-1} role="region" aria-label={TAB_NAMES.design} className="focus:outline-none" hidden={tab !== 'design'}>
              <DesignTab designs={siblings} slug={cur} packageKey={pkg.key} onSwitch={switchDesign}
                schemes={design.colorSchemes} scheme={chosen?.name ?? ''} onScheme={setScheme} style={style} onStyle={setStyle} active={tab === 'design'} tier={tier} tracks={tracks} />
            </div>
            <div id="studio-photos" tabIndex={-1} role="region" aria-label={TAB_NAMES.photos} className="focus:outline-none" hidden={tab !== 'photos'}>
              {chosen && <PhotosTab limit={limit} photos={photos} onPhotos={setPhotos} style={style} onStyle={setStyle} primary={effectiveScheme(chosen, style).primary} />}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-6">
              {check.ok === false && !error && <p className="text-xs text-amber-800">Still needed: {check.error}.</p>}
              <button type="submit" className={submitCls}>Review &amp; checkout</button>
            </div>
          </div>

          {reviewed && (
            <div hidden={!review} className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h2 id="review-heading" tabIndex={-1} className="focus:outline-none text-lg font-extrabold text-slate-900 font-display">Review &amp; checkout</h2>
                <button type="button" onClick={() => edit(tab)} className="text-xs font-bold text-slate-700 underline cursor-pointer">Back to editing</button>
              </div>
              <dl className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs font-bold uppercase tracking-wider text-slate-600 font-display">{r.label}</dt>
                      <dd className="text-sm text-slate-900 break-words whitespace-pre-line">{r.value}</dd>
                    </div>
                    <button type="button" onClick={() => edit(r.tab)} className="shrink-0 px-3 py-1 rounded-full border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer">
                      {r.edit ?? <>Edit<span className="sr-only"> {r.label.toLowerCase()}</span></>}
                    </button>
                  </div>
                ))}
              </dl>

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
                <div className="space-y-2">
                  {promo ? (
                    <><dl className="rounded-2xl border border-slate-200 p-4 text-sm space-y-1">
                      <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{peso(promo.subtotalCentavos)}</dd></div>
                      <div className="flex justify-between gap-3 text-emerald-800"><dt className="min-w-0 break-words">Discount ({promo.code} · {promo.label})</dt><dd className="shrink-0">−{peso(promo.discountCentavos)}</dd></div>
                      <div className="flex justify-between gap-3 border-t border-slate-200 pt-1 font-extrabold text-slate-900"><dt>Total</dt><dd>{peso(promo.totalCentavos)}</dd></div>
                    </dl>
                    <button type="button" onClick={removePromo} className="text-xs font-bold text-slate-700 underline cursor-pointer">Remove promo code</button></>
                  ) : (
                    <Field label="Promo code (optional)">
                      <div className="flex gap-2">
                        <input className={inputCls} autoCapitalize="characters" autoComplete="off" maxLength={30} value={promoInput} aria-describedby="promo-msg"
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }} />
                        <button type="button" onClick={applyPromo} disabled={promoBusy} className="shrink-0 px-5 rounded-full border border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-100 disabled:opacity-60 cursor-pointer">{promoBusy ? 'Checking…' : 'Apply'}</button>
                      </div>
                    </Field>
                  )}
                  <p id="promo-msg" role="status" className={promoMsg ? 'text-xs font-semibold text-red-700' : 'sr-only'}>{promoMsg}</p>
                </div>
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
                {review && error && <Alert>{error}</Alert>}
                <button type="submit" disabled={paying} className={submitCls}>
                  {paying ? 'Placing order…' : `Place order · ${peso(total)}`}
                </button>
                <p className="text-[11px] text-slate-600 text-center">Next you'll see our payment QR code. Scan it with GCash, Maya or any bank app that supports QR Ph, then upload your receipt; we confirm your payment before starting your invitation.</p>
              </fieldset>
            </div>
          )}
        </form>

        <section aria-label={review ? 'Preview of your invitation' : 'Live preview'} className={`${view === 'preview' ? 'block' : 'hidden'} lg:block min-w-0`}>
          <div className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm bg-white">
            <PreviewFrame cover={style.cover} onFocus={review || tab !== 'photos' ? undefined : (f) => setStyle((s) => (s.cover ? { ...s, cover: { ...s.cover, ...f } } : s))}>
              {chosen && <InvitationView layoutKey={design.layoutKey} scheme={chosen} details={form.preview(draft, form.toDraft(design.sampleDetails))} photos={photos} style={out} giftQr={giftQr ?? undefined} events={{ attire }} />}
            </PreviewFrame>
          </div>
        </section>
      </div>
    </div>
  );
}
