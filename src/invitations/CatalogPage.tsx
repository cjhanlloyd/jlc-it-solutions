// / and /invitations: the shop. Active designs, each with its price, a live sample preview and a link to the customiser.
import React from 'react';
import * as Icons from 'lucide-react';
import InvitationView from './InvitationView';
import { fetchDesigns, type Design } from './CustomiserPage';
import { Link, peso, toDraft, useInvitationFonts } from './kit';
import { occasionChips, occasionLabel } from './occasions';

const STEPS = ['Choose a design', 'Add your details and photos', 'Pay by QR Ph and share one link'];

export default function CatalogPage({ btn }: { btn: string }) {
  useInvitationFonts();
  const [designs, setDesigns] = React.useState<Design[] | null | 'offline'>(null);
  const [preview, setPreview] = React.useState<Design | null>(null);
  const [occasion, setOccasion] = React.useState<string | null>(null);
  const chips = Array.isArray(designs) ? occasionChips(designs.map((d) => d.productType)) : [];
  const shown = Array.isArray(designs) ? designs.filter((d) => !occasion || d.productType === occasion) : [];
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => { fetchDesigns().then(setDesigns, () => setDesigns('offline')); }, []);
  React.useEffect(() => {
    if (!preview) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [preview]);

  return (
    <div className="bg-slate-50 py-14 sm:py-20 select-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
            Digital invitations
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display">Find your invitation design</h1>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Tap Preview to see a design exactly as your guests will. Add your details, pay by QR Ph, and share one link — guests RSVP right on the page.
          </p>
        </div>

        {designs === null && <p className="text-center text-sm text-slate-500">Loading designs…</p>}
        {designs === 'offline' && <p className="text-center text-sm text-slate-600">We could not load the designs. Please check your connection and reload.</p>}
        {Array.isArray(designs) && designs.length === 0 && <p className="text-center text-sm text-slate-600">New designs are coming soon. Please check back later.</p>}

        {chips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8" role="group" aria-label="Filter designs by occasion">
            {[null, ...chips].map((t) => (
              <button key={t ?? 'all'} type="button" aria-pressed={occasion === t} onClick={() => setOccasion(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider font-display cursor-pointer ${occasion === t ? `text-white ${btn}` : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                {t ? occasionLabel(t) : 'All'}
              </button>
            ))}
          </div>
        )}

        {Array.isArray(designs) && designs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((d) => (
              <article key={d.slug} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="aspect-[4/5] bg-slate-100">
                  {d.previewImages[0]
                    ? <img src={d.previewImages[0]} alt={`${d.name} design preview`} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Heart className="h-12 w-12" /></div>}
                </div>
                <div className="p-5 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900 font-display">{d.name}</h2>
                    <span className="text-base font-extrabold text-slate-900">{peso(d.priceCentavos)}</span>
                  </div>
                  <div className="flex gap-1.5" aria-label={`${d.colorSchemes.length} color options`}>
                    {d.colorSchemes.map((s) => <span key={s.name} title={s.name} className="w-5 h-5 rounded-full border border-slate-300" style={{ background: s.primary }} />)}
                  </div>
                  <div className="flex gap-2 pt-2 mt-auto">
                    <button type="button" onClick={() => setPreview(d)} className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-slate-300 text-xs font-bold uppercase tracking-wider font-display text-slate-700 hover:bg-slate-100 cursor-pointer">
                      <Icons.Eye className="h-4 w-4 mr-1.5" /> Preview
                    </button>
                    <Link href={`/invitations/${encodeURIComponent(d.slug)}`} className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white ${btn}`}>
                      Customise
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <ol className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto" aria-label="How it works">
          {STEPS.map((step, i) => (
            <li key={step} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
              <span className={`w-8 h-8 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center ${btn}`}>{i + 1}</span>
              <span className="text-sm font-semibold text-slate-800">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-12 max-w-4xl mx-auto rounded-2xl bg-slate-900 text-slate-200 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-center sm:text-left"><span className="font-bold text-white">Also from JLC:</span> IT consulting, custom software and office networks</p>
          <Link href="/#/home" className="inline-flex items-center px-5 py-2 rounded-full border border-slate-600 text-xs font-bold uppercase tracking-wider font-display text-white hover:bg-slate-800">
            IT Services <Icons.ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex flex-col" role="dialog" aria-modal="true" aria-label={`${preview.name} sample preview`}>
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-bold text-slate-900 font-display truncate">{preview.name} <span className="font-normal text-slate-500">· sample</span></p>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/invitations/${encodeURIComponent(preview.slug)}`} onClick={() => setPreview(null)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white ${btn}`}>Customise</Link>
              <button ref={closeRef} type="button" onClick={() => setPreview(null)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close preview">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {preview.colorSchemes[0] && <InvitationView layoutKey={preview.layoutKey} scheme={preview.colorSchemes[0]} details={toDraft(preview.sampleDetails)} photos={preview.previewImages} />}
          </div>
        </div>
      )}
    </div>
  );
}
