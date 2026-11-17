// Promo codes (#/promos): list with redemption stats, create/edit, activate/deactivate, delete.
import { useEffect, useState, type FormEvent } from 'react';
import { normalizeCode, promoLabel, validatePromoInput } from '../../shared/promo';
import { Button, Card, EmptyState, Select, Spinner, TextField } from '../ui';
import type { Session } from './api';
import { centavosToPesos, pesosToCentavos } from './design-form';
import { isoToManila, manilaToIso, pesoText, promoStatus, validityText, type PromoStatus } from './promo-form';

type Promo = {
  id: number; code: string; description: string; discountType: 'percent' | 'fixed'; discountValue: number; minPurchaseCentavos: number;
  startsAt: string | null; expiresAt: string | null; maxUses: number | null; active: boolean;
  uses: number; redeemed: number; discountGivenCentavos: number; revenueCentavos: number;
};
type Form = { id: number | null; code: string; description: string; type: 'percent' | 'fixed'; value: string; min: string; startDate: string; startTime: string; endDate: string; endTime: string; maxUses: string; locked: boolean };

const blank: Form = { id: null, code: '', description: '', type: 'percent', value: '', min: '', startDate: '', startTime: '', endDate: '', endTime: '', maxUses: '', locked: false };
const PILL: Record<PromoStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-900', Inactive: 'bg-slate-200 text-slate-900', Expired: 'bg-red-100 text-red-900',
  Scheduled: 'bg-sky-100 text-sky-900', 'Used up': 'bg-amber-100 text-amber-900',
};

function toForm(p: Promo): Form {
  const s = isoToManila(p.startsAt), e = isoToManila(p.expiresAt);
  return {
    id: p.id, code: p.code, description: p.description, type: p.discountType,
    value: p.discountType === 'percent' ? String(p.discountValue) : centavosToPesos(p.discountValue),
    min: p.minPurchaseCentavos ? centavosToPesos(p.minPurchaseCentavos) : '', startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
    maxUses: p.maxUses == null ? '' : String(p.maxUses), locked: p.uses > 0,
  };
}

// Returns the request body, or an error message
function toBody(f: Form): { body: any } | { error: string } {
  if ((f.startDate === '' && f.startTime) || (f.endDate === '' && f.endTime)) return { error: 'Choose a date for each time you enter.' };
  const value = f.type === 'percent' ? Number(f.value) : pesosToCentavos(f.value);
  const min = f.min.trim() ? pesosToCentavos(f.min) : 0;
  const body = {
    code: f.code, description: f.description, discountType: f.type, discountValue: Number.isNaN(value) ? 0 : value,
    minPurchaseCentavos: Number.isNaN(min) ? -1 : min,
    startsAt: manilaToIso(f.startDate, f.startTime), expiresAt: manilaToIso(f.endDate, f.endTime, true),
    maxUses: f.maxUses.trim() ? Number(f.maxUses) : null,
  };
  const v = validatePromoInput(body);
  return v.ok === false ? { error: v.error } : { body };
}

export default function PromosPage({ session }: { session: Session }) {
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState('');

  const load = () => session.api<{ promos: Promo[] }>('/api/admin/promos').then((d) => setPromos(d.promos)).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(body: unknown, onError: (m: string) => void = setError): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await session.api('/api/admin/promos', body);
      await load();
      return true;
    } catch (e) {
      onError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const r = toBody(form);
    if ('error' in r) return setFormError(r.error);
    setFormError('');
    if (await run({ action: form.id == null ? 'create' : 'update', ...(form.id != null && { id: form.id }), ...r.body }, setFormError)) setForm(null);
  }

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const now = new Date();

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Promo codes</h1>
        {!form && <Button className="ml-auto" onClick={() => { setForm(blank); setFormError(''); }}>New promo code</Button>}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-700">Customers enter a code at checkout for a percent or fixed discount. Dates and times are in Manila time.</p>

      {form && (
        <Card className="mt-4 max-w-2xl">
          <form onSubmit={save} className="space-y-3">
            <h2 className="font-display text-lg font-bold">{form.id == null ? 'New promo code' : 'Edit promo code'}</h2>
            <TextField label="Code" value={form.code} onChange={(e) => set({ code: normalizeCode(e.target.value) })} maxLength={30} required readOnly={form.locked} autoCapitalize="characters" autoComplete="off"
              hint={form.locked ? 'This code has been used, so it cannot change.' : '3 to 30 letters, numbers or dashes.'} />
            <TextField label="Description (optional)" value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={120} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Discount type" value={form.type} onChange={(e) => set({ type: e.target.value as Form['type'], value: '' })}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </Select>
              <TextField label={form.type === 'percent' ? 'Percent off (1 to 100)' : 'Amount off (₱)'} value={form.value} onChange={(e) => set({ value: e.target.value })} inputMode="decimal" required />
            </div>
            <TextField label="Minimum purchase (₱, optional)" value={form.min} onChange={(e) => set({ min: e.target.value })} inputMode="decimal" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Starts (date)" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              <TextField label="Starts (time)" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} hint="Blank means the start of the day." />
              <TextField label="Expires (date)" type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              <TextField label="Expires (time)" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} hint="Blank means the end of that day (11:59 PM)." />
            </div>
            <TextField label="Maximum uses (optional)" value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })} inputMode="numeric" hint="Leave empty for unlimited." />
            {formError && <p role="alert" className="text-sm font-medium text-red-700">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={busy} disabled={busy}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!promos && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading promo codes…</p>}
      {promos && (promos.length === 0 ? (
        <div className="mt-6"><EmptyState title="No promo codes yet">Create one with the button above.</EmptyState></div>
      ) : (
        <ul className="mt-4 space-y-3">
          {promos.map((p) => {
            const st = promoStatus(p, now);
            return (
              <li key={p.id}><Card>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-all font-mono text-lg font-bold">{p.code}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[st]}`}>{st}</span>
                  <span className="ml-auto font-semibold">{promoLabel(p.discountType, p.discountValue)}</span>
                </div>
                {p.description && <p className="mt-1 text-sm text-slate-700">{p.description}</p>}
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-slate-600">Valid: </dt><dd className="inline">{validityText(p.startsAt, p.expiresAt)}</dd></div>
                  <div><dt className="inline text-slate-600">Uses: </dt><dd className="inline">{p.uses}{p.maxUses != null ? ` of ${p.maxUses}` : ' (no limit)'}</dd></div>
                  {p.minPurchaseCentavos > 0 && <div><dt className="inline text-slate-600">Minimum purchase: </dt><dd className="inline">{pesoText(p.minPurchaseCentavos)}</dd></div>}
                  <div><dt className="inline text-slate-600">Paid orders: </dt><dd className="inline">{p.redeemed} · {pesoText(p.discountGivenCentavos)} discounted · {pesoText(p.revenueCentavos)} revenue</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setForm(toForm(p)); setFormError(''); window.scrollTo({ top: 0 }); }}>Edit</Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run({ action: 'toggle', id: p.id, active: !p.active })}>{p.active ? 'Deactivate' : 'Activate'}</Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => { if (confirm(`Delete promo code ${p.code}?`)) run({ action: 'delete', id: p.id }); }}>Delete</Button>
                </div>
              </Card></li>
            );
          })}
        </ul>
      ))}
    </section>
  );
}
