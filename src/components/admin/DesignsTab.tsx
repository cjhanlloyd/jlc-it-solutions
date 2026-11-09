import React from 'react';
import * as Icons from 'lucide-react';
import { adminApi } from './api.js';
import type { AdminTabProps } from './types.js';
import { money, type InvTabProps } from './InvitationsCommon.js';
import InvitationView from '../../invitations/InvitationView.js';
import { useInvitationFonts } from '../../invitations/kit.js';
import { LAYOUT_KEYS, validateDetails } from '../../../shared/invitation-fields.js';

type Scheme = { name: string; primary: string; accent: string; background: string; text: string };
const newScheme = (): Scheme => ({ name: '', primary: '#7a1f3d', accent: '#c9a45c', background: '#fffaf5', text: '#2b2b2b' });
const SAMPLE = JSON.stringify({
  partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', eventTime: '16:00',
  ceremony: { name: 'St. Joseph Church', address: 'Manila', mapUrl: '' }, schedule: [], message: 'We would love to celebrate with you.',
}, null, 2);
const blank = () => ({ id: null as number | null, slug: '', name: '', layout_key: 'classic', pesos: '', schemes: [newScheme()], images: '', sample: SAMPLE, active: true });

export default function DesignsTab({ overview, reload, adminToken, adminUser, isSaving, run }: AdminTabProps & InvTabProps) {
  useInvitationFonts();
  const canWrite = adminUser.role !== 'Editor';
  const [form, setForm] = React.useState(blank());
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const setScheme = (i: number, patch: Partial<Scheme>) => set({ schemes: form.schemes.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

  const parsed = React.useMemo(() => {
    try {
      const v = validateDetails(JSON.parse(form.sample));
      return v.ok === false ? { error: v.error } : { details: v.details };
    } catch { return { error: 'Sample details is not valid JSON.' }; }
  }, [form.sample]);

  const edit = (d: any) => setForm({
    id: d.id, slug: d.slug, name: d.name, layout_key: d.layout_key, pesos: String(d.price_centavos / 100),
    schemes: d.color_schemes, images: d.preview_images.join('\n'), sample: JSON.stringify(d.sample_details, null, 2), active: d.active,
  });

  const post = (body: object, msg: string) => run(async () => {
    await adminApi('/api/admin/invitations/designs', adminToken, body, 'Failed to save design.');
    await reload();
  }, msg);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if ('error' in parsed) return window.alert(parsed.error);
    await post({
      action: form.id ? 'update' : 'add', id: form.id ?? undefined, slug: form.slug.trim(), name: form.name, layout_key: form.layout_key,
      price_centavos: Math.round(Number(form.pesos) * 100), color_schemes: form.schemes,
      preview_images: form.images.split('\n').map((s) => s.trim()).filter(Boolean), sample_details: JSON.parse(form.sample), active: form.active,
    }, form.id ? 'Design updated.' : 'Design added.');
    setForm(blank());
  };

  const inp = 'w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900';
  const lbl = 'text-[10px] uppercase font-bold text-gray-500 font-mono';

  return (
    <div className="space-y-6" id="panel-designs">
      <div className="border-b border-gray-100 pb-4 flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">Invitation Designs</h2>
          <p className="text-xs text-gray-500 font-sans mt-1">The catalog customers choose from.</p>
        </div>
        <button onClick={() => reload()} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">
          <Icons.RefreshCw className="h-3.5 w-3.5 inline mr-1.5" />Refresh
        </button>
      </div>

      {canWrite && (
        <form onSubmit={save} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/60 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">{form.id ? `Edit design #${form.id}` : 'Add design'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5"><label className={lbl}>Name</label><input required className={inp} value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="space-y-1.5"><label className={lbl}>Slug</label><input required className={inp} value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="classic-rose" /></div>
            <div className="space-y-1.5">
              <label className={lbl}>Layout {form.id && <span className="font-normal lowercase">(read-only)</span>}</label>
              <select disabled={!!form.id} className={`${inp} disabled:bg-slate-100`} value={form.layout_key} onChange={(e) => set({ layout_key: e.target.value })}>
                {LAYOUT_KEYS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><label className={lbl}>Price (pesos)</label><input required type="number" min="10" step="0.01" className={inp} value={form.pesos} onChange={(e) => set({ pesos: e.target.value })} /></div>
          </div>

          <div className="space-y-2">
            <label className={lbl}>Color schemes</label>
            {form.schemes.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input required className={`${inp} !w-40`} placeholder="Name" value={s.name} onChange={(e) => setScheme(i, { name: e.target.value })} />
                {(['primary', 'accent', 'background', 'text'] as const).map((k) => (
                  <label key={k} className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                    {k}<input type="color" value={s[k]} onChange={(e) => setScheme(i, { [k]: e.target.value })} />
                  </label>
                ))}
                <button type="button" disabled={form.schemes.length < 2} onClick={() => set({ schemes: form.schemes.filter((_, n) => n !== i) })} className="p-1.5 border border-gray-100 text-gray-400 hover:text-red-600 rounded-lg cursor-pointer disabled:opacity-40" title="Remove scheme">
                  <Icons.Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set({ schemes: [...form.schemes, newScheme()] })} className="text-xs font-semibold text-blue-600 cursor-pointer">+ Add color scheme</button>
          </div>

          <div className="space-y-1.5"><label className={lbl}>Preview image URLs (https, one per line)</label><textarea rows={2} className={inp} value={form.images} onChange={(e) => set({ images: e.target.value })} /></div>
          <div className="space-y-1.5">
            <label className={lbl}>Sample details (JSON)</label>
            <textarea rows={8} className={`${inp} font-mono`} value={form.sample} onChange={(e) => set({ sample: e.target.value })} />
            {'error' in parsed && <p className="text-xs text-red-600">{parsed.error}</p>}
          </div>
          <label className="text-xs text-gray-700 flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />Active (shown in the catalog)</label>

          {'details' in parsed && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-gray-400 border-b border-gray-100">Preview (first color scheme)</div>
              <div className="max-h-[480px] overflow-auto">
                <InvitationView layoutKey={form.layout_key} scheme={form.schemes[0]} details={parsed.details} photos={[]} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {form.id && <button type="button" onClick={() => setForm(blank())} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 cursor-pointer">Cancel Edit</button>}
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer">{form.id ? 'Save design' : 'Add design'}</button>
          </div>
        </form>
      )}

      {!overview ? <p className="text-xs text-gray-400">Loading...</p> : (
        <div className="divide-y divide-gray-100">
          {overview.designs.map((d, i, all) => {
            const move = (dir: number) => {
              const ids = all.map((x) => x.id);
              [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
              return post({ action: 'reorder', ids }, 'Order updated.');
            };
            return (
              <div key={d.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-gray-900">{d.name}</span>{' '}
                  <span className="text-[10px] font-mono text-gray-400">{d.slug} · {d.layout_key} · {money(d.price_centavos)}</span>{' '}
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${d.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{d.active ? 'Active' : 'Hidden'}</span>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <button disabled={isSaving || i === 0} onClick={() => move(-1)} className="p-1.5 border border-gray-100 text-gray-500 rounded-lg cursor-pointer disabled:opacity-40" title="Move up"><Icons.ArrowUp className="h-3.5 w-3.5" /></button>
                    <button disabled={isSaving || i === all.length - 1} onClick={() => move(1)} className="p-1.5 border border-gray-100 text-gray-500 rounded-lg cursor-pointer disabled:opacity-40" title="Move down"><Icons.ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { edit(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">Edit</button>
                    <button disabled={isSaving} onClick={() => post({ action: 'toggle', id: d.id, active: !d.active }, d.active ? 'Design hidden.' : 'Design shown.')} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">{d.active ? 'Hide' : 'Show'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
