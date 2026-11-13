// GCash payment settings (Super Admin): account name, number, instructions, deadline hours and QR code.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Spinner, TextArea, TextField } from '../ui';
import type { Session } from './api';

type Settings = { gcashAccountName: string; gcashNumber: string; instructions: string; deadlineHours: number; qrUrl: string | null };

export default function PaymentSettingsPage({ session }: { session: Session }) {
  const [form, setForm] = useState<Settings | null>(null);
  const [qrImage, setQrImage] = useState(''); // new QR as a data: URL, sent only when chosen
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [loadedAt, setLoadedAt] = useState(0);
  const load = () => session.api<Settings>('/api/admin/payment-settings').then((s) => { setForm(s); setLoadedAt(Date.now()); }, (e: Error) => setError(e.message));
  useEffect(() => { load(); }, [session]);

  function pickQr(file: File | undefined) {
    if (!file) return;
    // Sent unchanged (no re-compression) so the QR stays scannable; the server checks type and size
    const reader = new FileReader();
    reader.onload = () => setQrImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await session.api('/api/admin/payment-settings', {
        gcashAccountName: form.gcashAccountName, gcashNumber: form.gcashNumber, instructions: form.instructions, deadlineHours: form.deadlineHours,
        ...(qrImage && { qrImage }),
      });
      setQrImage('');
      setNotice('GCash settings saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (!form) return error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading settings…</p>;
  const set = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  // The public QR route caches for 5 minutes, so bust it after each load
  const preview = qrImage || (form.qrUrl && `${form.qrUrl}?v=${loadedAt}`);
  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Payment settings</h1>
      <p className="mt-1 text-sm text-slate-600">Customers see these GCash details on their order page.</p>
      <Card className="mt-4 max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <TextField label="GCash account name" required maxLength={80} value={form.gcashAccountName} onChange={(e) => set({ gcashAccountName: e.target.value })} />
          <TextField label="GCash number" required maxLength={30} inputMode="tel" value={form.gcashNumber} onChange={(e) => set({ gcashNumber: e.target.value })} />
          <TextArea label="Payment instructions" rows={4} maxLength={1000} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} />
          <TextField label="Payment deadline (hours after the order)" type="number" min={1} max={168} step={1} required value={form.deadlineHours}
            onChange={(e) => set({ deadlineHours: Number(e.target.value) })} hint="1 to 168 hours. Unpaid orders expire after this." />
          <div>
            <label htmlFor="qr" className="mb-1 block text-sm font-medium text-slate-800">GCash QR code</label>
            <input id="qr" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="qr-hint" onChange={(e) => pickQr(e.target.files?.[0])} className="text-sm" />
            <p id="qr-hint" className="mt-1 text-xs text-slate-600">PNG, JPEG or WebP, up to 2 MB.{qrImage && ' Not saved yet.'}</p>
            {preview ? <img src={preview} alt="GCash QR code preview" className="mt-3 h-48 w-48 rounded-control border border-slate-200 object-contain" />
              : <p className="mt-2 text-sm text-slate-600">No QR code uploaded yet.</p>}
          </div>
          <div aria-live="polite">
            {notice && <p className="text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          </div>
          <Button type="submit" loading={busy}>Save settings</Button>
        </form>
      </Card>
    </section>
  );
}
