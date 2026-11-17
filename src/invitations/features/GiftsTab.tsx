// Manage page "Gifts": the wish list (add, edit, reorder, reservations) and cash methods (saved as extras).
import React from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { EXTRAS_LIMITS, GIFT_ITEMS_MAX, type Extras, type GiftMethod } from '../../../shared/extras';
import { Alert, inputCls, labelCls } from '../kit';
import { btnCls, ghostBtn, OFFLINE, postJson, type Api } from './shared';

export type GiftItem = { id: number; name: string; note: string; link: string | null; priceCentavos: number | null; reservedName: string | null; reservedAt: string | null; sortOrder: number };
type Draft = { id?: number; name: string; note: string; link: string; price: string };
const EMPTY: Draft = { name: '', note: '', link: '', price: '' };
const peso = (c: number) => `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: c % 100 ? 2 : 0 })}`;

export default function GiftsTab({ api, extras, onExtras, items, onItems }: { api: Api; extras: Extras; onExtras: (e: Extras) => void; items: GiftItem[]; onItems: (i: GiftItem[]) => void }) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [methods, setMethods] = React.useState<GiftMethod[]>(extras.gifts?.methods ?? []);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Resolves true when the server accepted the change
  async function run(fn: () => Promise<Response>, ok?: (b: any) => void | Promise<void>, done?: string): Promise<boolean> {
    setBusy(true); setMsg(null);
    let good = false;
    try {
      const res = await fn();
      const b = await res.json().catch(() => ({}));
      if (res.ok) { await ok?.(b); good = true; if (done) setMsg({ kind: 'success', text: done }); } else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
    return good;
  }
  const reload = async () => { const res = await api(''); if (res.ok) onItems((await res.json()).giftItems); };
  const act = (body: object, done?: string) => run(() => postJson(api, '/gifts', body), reload, done);

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    const price = draft.price.trim() === '' ? null : Math.round(Number(draft.price) * 100);
    if (price !== null && !Number.isFinite(price)) return setMsg({ kind: 'error', text: 'Enter the price as a number, like 1500.' });
    if (await act({ action: draft.id ? 'update' : 'add', id: draft.id, name: draft.name, note: draft.note, link: draft.link, priceCentavos: price }, draft.id ? 'Gift updated.' : 'Gift added.')) setDraft(EMPTY);
  }
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void act({ action: 'reorder', ids });
  };
  const saveMethods = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = methods.map((m) => ({ label: m.label.trim(), accountNumber: m.accountNumber.trim(), ...(m.accountName?.trim() ? { accountName: m.accountName.trim() } : {}) }));
    const { gifts: _g, ...rest } = extras;
    return run(() => postJson(api, '/extras', { extras: clean.length ? { ...rest, gifts: { methods: clean } } : rest }), (b) => onExtras(b.extras), 'Cash gift details saved.');
  };
  const setMethod = (i: number, patch: Partial<GiftMethod>) => setMethods(methods.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <div className="space-y-8">
      <section aria-labelledby="wish-h" className="space-y-4">
        <h3 id="wish-h" className="text-sm font-extrabold text-slate-900 font-display">Wish list ({items.length}/{GIFT_ITEMS_MAX})</h3>
        {items.length === 0 ? <p className="text-sm text-slate-600">No gifts yet. Add things your guests can choose to give.</p> : (
          <ol className="space-y-3">
            {items.map((g, i) => (
              <li key={g.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 break-words">{g.name}{g.priceCentavos != null && <span className="font-normal text-slate-600"> · {peso(g.priceCentavos)}</span>}</p>
                {g.note && <p className="text-sm text-slate-600 break-words">{g.note}</p>}
                {g.reservedAt && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-800">
                    <span>Chosen by {g.reservedName}</span>
                    <button type="button" disabled={busy} onClick={() => act({ action: 'release', id: g.id }, 'Released. Guests can choose it again.')} className={ghostBtn}>Release<span className="sr-only"> {g.name}</span></button>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${g.name} up`} className={ghostBtn}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${g.name} down`} className={ghostBtn}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" disabled={busy} onClick={() => setDraft({ id: g.id, name: g.name, note: g.note, link: g.link ?? '', price: g.priceCentavos == null ? '' : String(g.priceCentavos / 100) })} className={ghostBtn}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit<span className="sr-only"> {g.name}</span></button>
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete "${g.name}" from the wish list?`)) void act({ action: 'delete', id: g.id }, 'Gift deleted.'); }} className={`${ghostBtn} text-red-700`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete<span className="sr-only"> {g.name}</span></button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={submitItem} className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <h4 className="text-sm font-bold text-slate-900">{draft.id ? 'Edit gift' : 'Add a gift'}</h4>
          <label className="block"><span className={labelCls}>Gift name</span><input required maxLength={80} className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="block"><span className={labelCls}>Note (optional)</span><input maxLength={200} className={inputCls} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
          <label className="block"><span className={labelCls}>Link (optional, https)</span><input type="url" maxLength={500} className={inputCls} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://" /></label>
          <label className="block"><span className={labelCls}>Price in pesos (optional)</span><input inputMode="decimal" className={inputCls} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || (!draft.id && items.length >= GIFT_ITEMS_MAX)} className={btnCls}>{draft.id ? 'Save gift' : 'Add gift'}</button>
            {draft.id && <button type="button" onClick={() => setDraft(EMPTY)} className={ghostBtn}>Cancel</button>}
          </div>
        </form>
      </section>

      <form onSubmit={saveMethods} className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="cash-h">
        <h3 id="cash-h" className="text-sm font-extrabold text-slate-900 font-display">Cash gifts</h3>
        <p className="text-xs text-slate-600">Your gift note and gift QR code (set in Edit details) also show in the gift section of your invitation.</p>
        {methods.map((m, i) => (
          <fieldset key={i} className="space-y-2 rounded-2xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-bold text-slate-700">Method {i + 1}</legend>
            <label className="block"><span className={labelCls}>Name (GCash, Maya, BPI)</span><input required maxLength={EXTRAS_LIMITS.label} className={inputCls} value={m.label} onChange={(e) => setMethod(i, { label: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>Account name</span><input maxLength={EXTRAS_LIMITS.accountName} className={inputCls} value={m.accountName ?? ''} onChange={(e) => setMethod(i, { accountName: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>Account number</span><input required maxLength={EXTRAS_LIMITS.accountNumber} className={inputCls} value={m.accountNumber} onChange={(e) => setMethod(i, { accountNumber: e.target.value })} /></label>
            <button type="button" onClick={() => setMethods(methods.filter((_, j) => j !== i))} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 underline cursor-pointer">Remove method {i + 1}</button>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          {methods.length < EXTRAS_LIMITS.methods && <button type="button" onClick={() => setMethods([...methods, { label: '', accountNumber: '' }])} className={ghostBtn}><Plus className="h-4 w-4" aria-hidden="true" /> Add a method</button>}
          <button type="submit" disabled={busy} className={btnCls}>Save cash gifts</button>
        </div>
      </form>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
