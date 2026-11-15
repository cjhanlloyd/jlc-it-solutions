// One inquiry: submitted fields, attachment, status, notes, reply, order link, communication history, customer link, delete.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Select, Spinner, TextArea, TextField } from '../ui';
import { fmtManila, type Session } from './api';
import { INQUIRY_STATUSES } from './InquiriesPage';

type Inquiry = {
  id: string; fullName: string; companyName: string | null; email: string; phone: string; serviceRequired: string; projectDescription: string;
  preferredContactMethod: string; status: string; createdAt: string; adminNotes: string | null; budget: string | null; isCustomRequest: boolean;
  attachment: { name: string; type: string; size: number } | null;
};
type Mail = { id: string; to_address: string; subject: string; body: string; sentAt: string; email_type: string };
type Detail = { inquiry: Inquiry; customerId: number; emails: Mail[] };
type Design = { slug: string; name: string; active: boolean; packages: { key: string; name: string; kind?: string }[] };

export default function InquiryDetail({ session, id }: { session: Session; id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [designs, setDesigns] = useState<Design[]>([]);
  const [designsError, setDesignsError] = useState('');
  const [slug, setSlug] = useState('');
  const [pkg, setPkg] = useState('');
  const url = `/api/admin/inquiries/${encodeURIComponent(id)}`;

  const load = useCallback(() => session.api<Detail>(url).then((d) => {
    setData(d);
    setNotes((n) => n || d.inquiry.adminNotes || '');
    setSubject((s) => s || `Re: ${d.inquiry.serviceRequired}`);
  }, (e: Error) => setLoadError(e.message)), [session, url]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    session.api<{ designs: Design[] }>('/api/admin/designs').then((r) => setDesigns(r.designs.filter((d) => d.active)), (e: Error) => setDesignsError(e.message));
  }, [session]);

  // Every action re-fetches, success or not, so the page shows what the server now has
  async function run(payload: Record<string, unknown>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await session.api(url, payload);
      setNotice(done);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function download(name: string) {
    setError('');
    try {
      const href = await session.image(`${url}/attachment`);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The attachment could not be downloaded.');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this inquiry permanently? This cannot be undone.')) return;
    if (await run({ action: 'delete' }, 'Deleted.')) window.location.hash = '#/inquiries';
  }

  if (loadError && !data) return <p role="alert" className="text-sm font-medium text-red-700">{loadError} <a href="#/inquiries" className="underline">Back to inquiries</a></p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading inquiry…</p>;
  const { inquiry: q, emails, customerId } = data;
  const known = INQUIRY_STATUSES.includes(q.status);
  const packages = designs.find((d) => d.slug === slug)?.packages.filter((p) => p.kind !== 'custom') ?? [];
  const field = (label: string, value: string | null | undefined) => (
    <div><dt className="text-slate-600">{label}</dt><dd className="break-words">{value || '—'}</dd></div>
  );

  return (
    <div className="space-y-5">
      <a href="#/inquiries" className="text-sm font-semibold text-brand-800 hover:underline">← Inquiries</a>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">{q.fullName}</h1>
          {q.isCustomRequest && <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900">Custom request</span>}
          <a href={`#/customers/${customerId}`} className="ml-auto text-sm font-semibold text-brand-800 underline">View customer</a>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {field('Email', q.email)}
          {field('Phone', q.phone)}
          {field('Company', q.companyName)}
          {field('Service required', q.serviceRequired)}
          {field('Preferred contact', q.preferredContactMethod)}
          {field('Budget', q.budget)}
          {field('Received', fmtManila(q.createdAt))}
          {field('Status', q.status)}
        </dl>
        <h2 className="mt-4 text-sm font-semibold text-slate-600">Description</h2>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{q.projectDescription}</p>
        {q.attachment && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="break-all">{q.attachment.name} ({Math.max(1, Math.round(q.attachment.size / 1024))} KB)</span>
            <Button size="sm" variant="secondary" onClick={() => download(q.attachment!.name)}>Download attachment</Button>
          </div>
        )}
      </Card>

      <div aria-live="polite">
        {notice && <p role="status" className="rounded-control bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
        {error && <p role="alert" className="rounded-control bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Status</h2>
          <div className="mt-3">
            <Select label="Inquiry status" value={q.status} disabled={busy} onChange={(e) => run({ action: 'status', status: e.target.value }, 'Status updated.')}>
              {!known && <option value={q.status}>{q.status}</option>}
              {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">Internal notes</h2>
          <form className="mt-3 space-y-2" onSubmit={(e: FormEvent) => { e.preventDefault(); run({ action: 'notes', adminNotes: notes }, 'Notes saved.'); }}>
            <TextArea label="Notes (only admins see these)" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} hint={`${notes.length}/2000`} />
            <Button type="submit" variant="secondary" loading={busy} disabled={busy}>Save notes</Button>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Reply by email</h2>
        <form className="mt-3 space-y-3" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await run({ action: 'reply', subject, body }, `Reply sent to ${q.email}.`)) setBody(''); }}>
          <TextField label="Subject" required maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextArea label="Message" required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} hint={`${body.length}/5000`} />
          <Button type="submit" loading={busy} disabled={busy || !subject.trim() || !body.trim()}>Send reply</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Send order link</h2>
        <p className="mt-1 text-sm text-slate-600">Emails the customer a link to personalise and order a design. The inquiry is marked Converted.</p>
        {designsError ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{designsError}</p> : (
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await run({ action: 'send-order-link', designSlug: slug, packageKey: pkg }, `Order link sent to ${q.email}.`)) { setSlug(''); setPkg(''); } }}>
            <Select label="Design" value={slug} onChange={(e) => { setSlug(e.target.value); setPkg(''); }}>
              <option value="">Choose a design</option>
              {designs.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
            <Select label="Package" value={pkg} disabled={!slug} onChange={(e) => setPkg(e.target.value)}>
              <option value="">Choose a package</option>
              {packages.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </Select>
            <div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={busy || !slug || !pkg}>Send order link</Button></div>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Communication history</h2>
        {emails.length === 0 ? <p className="mt-2 text-sm text-slate-600">No emails sent yet.</p> : (
          <ul className="mt-3 space-y-4">
            {emails.map((m) => (
              <li key={m.id} className="border-t border-slate-100 pt-3 text-sm first:border-0 first:pt-0">
                <p className="text-xs text-slate-600">{fmtManila(m.sentAt)} · {m.email_type} · to {m.to_address}</p>
                <p className="font-semibold">{m.subject}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div><Button variant="danger" disabled={busy} onClick={remove}>Delete inquiry</Button></div>
    </div>
  );
}
