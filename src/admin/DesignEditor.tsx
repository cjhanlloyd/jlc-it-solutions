// Design editor (#/designs/new, #/designs/<id>): details, colour schemes, images, sample details, packages, live preview.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { OCCASIONS, occasionOf } from '../../shared/occasions';
import { SAMPLES } from '../components/admin/design-samples';
import { useInvitationFonts } from '../invitations/kit';
import { Button, Card, Select, Spinner, TextArea, TextField } from '../ui';
import type { Session } from './api';
import { slugify } from './design-form';
import { ImagesEditor, NEW_SCHEME, SchemesEditor, type NamedScheme } from './DesignParts';
import PackagesEditor, { newRow, packagesError, toPackages, toRows, type PackageRow } from './PackagesEditor';

import { sampleStyle } from '../../shared/invitation-style';
const InvitationView = lazy(() => import('../invitations/InvitationView'));

type Form = {
  name: string; slug: string; slugEdited: boolean; productType: string; layoutKey: string; description: string;
  featured: boolean; active: boolean; schemes: NamedScheme[]; images: string[]; samples: string[]; sampleText: string; packages: PackageRow[];
};

const pretty = (o: unknown) => JSON.stringify(o, null, 2);
const FIRST_TYPE = Object.keys(OCCASIONS)[0];
const blank = (productType = FIRST_TYPE): Form => ({
  name: '', slug: '', slugEdited: false, productType, layoutKey: OCCASIONS[productType].layouts[0], description: '',
  featured: false, active: true, schemes: [NEW_SCHEME], images: [], samples: [], sampleText: pretty(SAMPLES[productType] ?? {}), packages: [newRow('Standard', '999')],
});

// Sample details JSON → the occasion's cleaned details, or an error message
function checkSample(productType: string, text: string): { ok: true; details: unknown } | { ok: false; error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'Sample details are not valid JSON.' }; }
  const v = occasionOf(productType)?.validateDetails(parsed);
  if (!v) return { ok: false, error: 'Unknown occasion.' };
  return v.ok === false ? { ok: false, error: `Sample details: ${v.error}` } : { ok: true, details: v.details };
}

// "Saved" survives the jump from #/designs/new to the new design's page (which remounts the editor)
let flash = '';

export default function DesignEditor({ session, id }: { session: Session; id: number | null }) {
  useInvitationFonts();
  const [form, setForm] = useState<Form | null>(id ? null : blank);
  const [clean, setClean] = useState(() => (id ? '' : JSON.stringify(blank())));
  const [orderCount, setOrderCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(() => { const f = flash; flash = ''; return f; });
  const [busy, setBusy] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [previewDetails, setPreviewDetails] = useState<{ type: string; details: unknown } | null>(null);
  const [schemeIdx, setSchemeIdx] = useState(0);

  async function fetchDesign(): Promise<{ f: Form; orderCount: number }> {
    const { design: d } = await session.api(`/api/admin/designs/${id}`);
    return { orderCount: d.orderCount, f: {
      name: d.name, slug: d.slug, slugEdited: true, productType: d.productType, layoutKey: d.layoutKey, description: d.description,
      featured: d.featured, active: d.active, schemes: d.colorSchemes, images: d.previewImages, samples: d.samplePhotos ?? [], sampleText: pretty(d.sampleDetails), packages: toRows(d.packages),
    } };
  }
  useEffect(() => {
    if (!id) return;
    fetchDesign().then(({ f, orderCount: n }) => { setForm(f); setClean(JSON.stringify(f)); setOrderCount(n); })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  const dirty = !!form && JSON.stringify(form) !== clean;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Warn before leaving with unsaved changes: closing the tab, or a hash route change.
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault(); };
    // Capture runs before the shell's hashchange listener, so a cancelled leave never re-renders the route
    const hash = (e: HashChangeEvent) => {
      if (!dirtyRef.current || window.confirm('You have unsaved changes. Leave this page?')) return;
      e.stopImmediatePropagation();
      history.replaceState(null, '', e.oldURL);
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('hashchange', hash, true);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('hashchange', hash, true); };
  }, []);

  // Preview keeps the last valid sample details while the JSON is being edited
  const sample = useMemo(() => (form ? checkSample(form.productType, form.sampleText) : null), [form?.productType, form?.sampleText]);
  useEffect(() => { if (form && sample?.ok) setPreviewDetails({ type: form.productType, details: sample.details }); }, [sample]);

  if (loadError) return <p role="alert" className="text-sm font-medium text-red-700">{loadError}</p>;
  if (!form) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading design…</p>;

  const set = (patch: Partial<Form>) => { setSaved(''); setForm((f) => f && { ...f, ...patch }); };
  const occasion = occasionOf(form.productType);
  const slugLocked = orderCount > 0;
  const scheme = form.schemes[Math.min(schemeIdx, form.schemes.length - 1)];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaved('');
    const s = checkSample(form.productType, form.sampleText);
    const problem = (s.ok === false ? s.error : '') || packagesError(form.packages);
    if (s.ok === false) setSampleError(s.error);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      const r = await session.api<{ id: number }>('/api/admin/designs', {
        action: id ? 'update' : 'create', ...(id ? { id } : {}),
        name: form.name, slug: form.slug, productType: form.productType, layoutKey: form.layoutKey, description: form.description,
        featured: form.featured, active: form.active, colorSchemes: form.schemes, previewImages: form.images, samplePhotos: form.samples,
        sampleDetails: s.ok ? s.details : null, packages: toPackages(form.packages),
      });
      if (id) {
        // Adopt only server-owned values (uploaded images as /media/ paths, normalised packages, order count); keep the rest as typed
        try {
          const { f: srv, orderCount: n } = await fetchDesign();
          const next = { ...form, images: srv.images, samples: srv.samples, packages: srv.packages };
          setForm(next);
          setClean(JSON.stringify(next));
          setOrderCount(n);
          setSaved('Saved.');
        } catch {
          setError("Saved, but the page couldn't refresh — reload to see the latest.");
        }
      } else {
        dirtyRef.current = false;
        flash = 'Design created.';
        window.location.hash = `#/designs/${r.id}`;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="#/designs" className="text-sm font-semibold text-brand-800 hover:underline">← Designs</a>
          <h1 className="font-display text-2xl font-bold">{id ? form.name || 'Design' : 'New design'}</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && <p role="status" className="text-sm font-medium text-emerald-800">{saved}</p>}
          {dirty && !saved && <p className="text-sm text-slate-600">Unsaved changes</p>}
          <Button type="submit" loading={busy}>{id ? 'Save changes' : 'Create design'}</Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* Disabled while saving so nothing typed mid-save is lost when server values come back */}
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <Card>
            <h2 className="font-display text-lg font-semibold">Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Name" maxLength={80} required value={form.name}
                onChange={(e) => set({ name: e.target.value, ...(form.slugEdited ? {} : { slug: slugify(e.target.value) }) })} />
              <TextField label="Slug (web address)" maxLength={60} value={form.slug} readOnly={slugLocked}
                hint={slugLocked ? `Locked: this design has ${orderCount} order${orderCount === 1 ? '' : 's'}, so its web address can't change.` : `/designs/${form.slug || '…'}`}
                onChange={(e) => set({ slug: e.target.value.toLowerCase(), slugEdited: true })} />
              {id ? (
                <TextField label="Occasion" value={occasion?.label ?? form.productType} readOnly hint="Fixed after creation." />
              ) : (
                <Select label="Occasion" value={form.productType}
                  onChange={(e) => { const t = e.target.value; set({ productType: t, layoutKey: OCCASIONS[t].layouts[0], sampleText: pretty(SAMPLES[t] ?? {}) }); setSampleError(''); }}>
                  {Object.values(OCCASIONS).map((o) => <option key={o.productType} value={o.productType}>{o.label}</option>)}
                </Select>
              )}
              <Select label="Layout" value={form.layoutKey} disabled={!!id} hint={id ? 'Fixed after creation.' : undefined} onChange={(e) => set({ layoutKey: e.target.value })}>
                {(occasion?.layouts ?? [form.layoutKey]).map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div className="mt-4">
              <TextArea label="Description" rows={3} maxLength={600} value={form.description} hint={`${form.description.length}/600`} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm font-medium text-slate-800">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} /> Featured</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> Published (shown in the shop)</label>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Colour schemes</h2>
            <div className="mt-4"><SchemesEditor schemes={form.schemes} onChange={(schemes) => set({ schemes })} /></div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Images</h2>
            <div className="mt-4"><ImagesEditor images={form.images} onChange={(images) => set({ images })} /></div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Sample photos</h2>
            <p className="mt-1 text-sm text-slate-600">Shown in the shop's live previews: the first is the cover, the rest fill the gallery. Customers replace them with their own photos when they customise.</p>
            <div className="mt-4"><ImagesEditor images={form.samples} onChange={(samples) => set({ samples })} label="Sample photo" hint="JPEG, PNG or WebP. Photos are resized before upload; portrait photos work best for the cover." /></div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Packages</h2>
            <p className="mt-1 text-sm text-slate-600">The lowest Template price is the design's “From” price.</p>
            <div className="mt-4"><PackagesEditor rows={form.packages} onChange={(packages) => set({ packages })} /></div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Sample details</h2>
            <div className="mt-4">
              <TextArea label="Sample details (JSON)" rows={14} spellCheck={false} className="font-mono text-xs" value={form.sampleText} error={sampleError || undefined}
                hint="Shown in the shop preview. Checked with the occasion's rules."
                onChange={(e) => set({ sampleText: e.target.value })}
                onBlur={() => { const s = checkSample(form.productType, form.sampleText); setSampleError(s.ok === false ? s.error : ''); }} />
            </div>
          </Card>
        </fieldset>

        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="font-display text-base font-semibold">Live preview</h2>
              {form.schemes.length > 1 && (
                <div className="w-40"><Select label="Scheme" value={String(Math.min(schemeIdx, form.schemes.length - 1))} onChange={(e) => setSchemeIdx(Number(e.target.value))}>
                  {form.schemes.map((s, i) => <option key={i} value={i}>{s.name || `Scheme ${i + 1}`}</option>)}
                </Select></div>
              )}
            </div>
            <div className="mt-3 max-h-[75vh] overflow-y-auto rounded-control border border-slate-200">
              {previewDetails?.type === form.productType ? (
                <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm text-slate-600"><Spinner /> Loading preview…</p>}>
                  <InvitationView key={form.productType} layoutKey={form.layoutKey} scheme={scheme} details={previewDetails.details} photos={form.samples} style={sampleStyle(form.samples.length)} />
                </Suspense>
              ) : <p className="p-4 text-sm text-slate-600">Fix the sample details to see a preview.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </form>
  );
}
