// Content & settings (#/content): homepage copy, FAQ, testimonials, banner, contact & social, branding. Each tab saves on its own.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isSafeLink } from '../../shared/links';
import { optimizeImage } from '../components/admin/images';
import { HERO } from '../site/home-content';
import { splitAnswer } from '../site/faq-text';
import { Button, Card, Select, Spinner, TextArea, TextField } from '../ui';
import type { Session } from './api';

type Content = {
  home: { eyebrow: string; headline: string; subheadline: string };
  faqs: { id: string; question: string; answer: string }[];
  testimonials: { id: number; name: string; occasion: string; quote: string; photoUrl: string | null; published: boolean }[];
  banner: { message: string; link: string; active: boolean; startsAt: string; endsAt: string };
  contact: { email: string; phone: string; address: string; hours: string; mapEmbedUrl: string; facebookUrl: string; whatsappUrl: string; viberUrl: string };
  branding: { companyName: string; tagline: string; logoType: string; logoIcon: string; logoUrl: string | null; themeColor: string };
};
type Props = { session: Session; data: Content; reload: () => Promise<void> };

const TABS = ['Homepage', 'FAQ', 'Testimonials', 'Banner', 'Contact & social', 'Branding'] as const;
const slug = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, '-');
const count = (v: string, max: number) => `${v.length}/${max}`;

// Shared save plumbing: busy, inline error and success message
function useSaver(session: Session, reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  async function run(body: unknown, message = 'Saved.') {
    setBusy(true); setError(''); setOk('');
    try {
      await session.api('/api/admin/content', body);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return false;
    }
    // The save went through; a failed refresh must not read as a failed save (admins would retry and duplicate)
    try { await reload(); setOk(message); }
    catch { setOk("Saved, but the page couldn't refresh — reload to see the latest."); }
    setBusy(false);
    return true;
  }
  const fail = (m: string) => { setOk(''); setError(m); };
  return { busy, error, ok, run, fail, clear: () => { setOk(''); setError(''); } };
}

function Msg({ error, ok }: { error: string; ok: string }) {
  return <>
    {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    {ok && <p role="status" className="text-sm font-medium text-emerald-800">{ok}</p>}
  </>;
}

function Section({ title, children, onSubmit, busy, error, ok, note }: { title: string; children: ReactNode; onSubmit: (e: FormEvent) => void; busy: boolean; error: string; ok: string; note?: string }) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {note && <p className="mt-1 text-sm text-slate-600">{note}</p>}
        <fieldset disabled={busy} className="mt-4 min-w-0 space-y-4">{children}</fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy}>Save</Button>
          <Msg error={error} ok={ok} />
        </div>
      </Card>
    </form>
  );
}

function HomeTab({ session, data, reload }: Props) {
  const [f, setF] = useState(data.home);
  const s = useSaver(session, reload);
  const set = (p: Partial<typeof f>) => { s.clear(); setF({ ...f, ...p }); };
  return (
    <Section title="Homepage text" busy={s.busy} error={s.error} ok={s.ok} note="Leave empty to use the default text."
      onSubmit={(e) => { e.preventDefault(); s.run({ section: 'home', ...f }); }}>
      <TextField label="Eyebrow" maxLength={40} placeholder={HERO.eyebrow} hint={count(f.eyebrow, 40)} value={f.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
      <TextField label="Headline" maxLength={90} placeholder={HERO.title} hint={count(f.headline, 90)} value={f.headline} onChange={(e) => set({ headline: e.target.value })} />
      <TextArea label="Subheadline" rows={3} maxLength={240} placeholder={HERO.lead} hint={count(f.subheadline, 240)} value={f.subheadline} onChange={(e) => set({ subheadline: e.target.value })} />
    </Section>
  );
}

function Reorder({ i, n, busy, move }: { i: number; n: number; busy: boolean; move: (d: -1 | 1) => void }) {
  return <>
    <Button type="button" variant="secondary" size="sm" disabled={busy || i === 0} onClick={() => move(-1)}>Up</Button>
    <Button type="button" variant="secondary" size="sm" disabled={busy || i === n - 1} onClick={() => move(1)}>Down</Button>
  </>;
}
const moved = <T,>(list: T[], i: number, d: -1 | 1) => { const a = [...list]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; };

function FaqTab({ session, data, reload }: Props) {
  const s = useSaver(session, reload);
  const [edit, setEdit] = useState<{ id?: string; question: string; answer: string } | null>(null);
  const discard = () => {
    const orig = data.faqs.find((x) => x.id === edit?.id);
    return !edit || (edit.question === (orig?.question ?? '') && edit.answer === (orig?.answer ?? '')) || window.confirm('Discard your unsaved changes?');
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const bad = [...edit.answer.matchAll(/\]\(([^()\s]*)\)/g)].find((m) => !isSafeLink(m[1]));
    if (bad) return s.fail('Links in answers must start with / or https://');
    if (await s.run({ section: 'faq', action: 'save', ...edit }, 'FAQ saved.')) setEdit(null);
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Invitation FAQ</h2>
          <Button type="button" size="sm" disabled={s.busy} onClick={() => { if (!discard()) return; s.clear(); setEdit({ question: '', answer: '' }); }}>Add question</Button>
        </div>
        <div className="mt-2"><Msg error={edit ? '' : s.error} ok={s.ok} /></div>
        <ul className="mt-3 divide-y divide-slate-200">
          {data.faqs.map((q, i) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{q.question}</p>
              <div className="flex gap-2">
                <Reorder i={i} n={data.faqs.length} busy={s.busy} move={(d) => s.run({ section: 'faq', action: 'reorder', ids: moved(data.faqs, i, d).map((x) => x.id) }, 'Order saved.')} />
                <Button type="button" variant="secondary" size="sm" disabled={s.busy} onClick={() => { if (!discard()) return; s.clear(); setEdit(q); }}>Edit</Button>
                <Button type="button" variant="secondary" size="sm" disabled={s.busy} onClick={() => { if (window.confirm('Delete this question?')) s.run({ section: 'faq', action: 'delete', id: q.id }, 'FAQ deleted.'); }}>Delete</Button>
              </div>
            </li>
          ))}
          {!data.faqs.length && <li className="py-3 text-sm text-slate-600">No questions yet.</li>}
        </ul>
      </Card>
      {edit && (
        <Section title={edit.id ? 'Edit question' : 'New question'} busy={s.busy} error={s.error} ok="" onSubmit={save}>
          <TextField label="Question" maxLength={160} required hint={count(edit.question, 160)} value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
          <TextArea label="Answer" rows={5} maxLength={800} required hint={`${count(edit.answer, 800)}. Link with [text](/page) or [text](https://…)`} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-slate-800">Preview</p>
            <p className="mt-1 whitespace-pre-line rounded-control border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {splitAnswer(edit.answer).map((p, i) => p.href ? <a key={i} href={p.href} className="font-semibold text-brand-800 underline">{p.text}</a> : <span key={i}>{p.text}</span>)}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
        </Section>
      )}
    </div>
  );
}

type TForm = { id?: number; name: string; occasion: string; quote: string; published: boolean; photoUrl: string | null; photo?: string; removePhoto?: boolean };
function TestimonialsTab({ session, data, reload }: Props) {
  const s = useSaver(session, reload);
  const [edit, setEdit] = useState<TForm | null>(null);
  const discard = () => {
    const o = data.testimonials.find((x) => x.id === edit?.id);
    const clean = !edit || (edit.name === (o?.name ?? '') && edit.occasion === (o?.occasion ?? '') && edit.quote === (o?.quote ?? '')
      && edit.published === (o?.published ?? true) && edit.photoUrl === (o?.photoUrl ?? null));
    return clean || window.confirm('Discard your unsaved changes?');
  };
  async function pick(file?: File) {
    if (!file || !edit) return;
    try { const photo = await optimizeImage(file, 800, 800, 0.85); setEdit({ ...edit, photo, photoUrl: photo, removePhoto: false }); }
    catch (e) { s.fail((e as Error).message); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const { photoUrl, ...body } = edit;
    if (await s.run({ section: 'testimonial', action: 'save', ...body }, 'Testimonial saved.')) setEdit(null);
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Testimonials</h2>
          <Button type="button" size="sm" disabled={s.busy} onClick={() => { if (!discard()) return; s.clear(); setEdit({ name: '', occasion: '', quote: '', published: true, photoUrl: null }); }}>Add testimonial</Button>
        </div>
        <div className="mt-2"><Msg error={edit ? '' : s.error} ok={s.ok} /></div>
        <ul className="mt-3 divide-y divide-slate-200">
          {data.testimonials.map((t, i) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.name} <span className="font-normal text-slate-600">· {t.published ? 'Published' : 'Hidden'}</span></p>
                <p className="truncate text-sm text-slate-700">{t.quote}</p>
              </div>
              <div className="flex gap-2">
                <Reorder i={i} n={data.testimonials.length} busy={s.busy} move={(d) => s.run({ section: 'testimonial', action: 'reorder', ids: moved(data.testimonials, i, d).map((x) => x.id) }, 'Order saved.')} />
                <Button type="button" variant="secondary" size="sm" disabled={s.busy} onClick={() => { if (!discard()) return; s.clear(); setEdit(t); }}>Edit</Button>
                <Button type="button" variant="secondary" size="sm" disabled={s.busy} onClick={() => { if (window.confirm(`Delete the testimonial from ${t.name}?`)) s.run({ section: 'testimonial', action: 'delete', id: t.id }, 'Testimonial deleted.'); }}>Delete</Button>
              </div>
            </li>
          ))}
          {!data.testimonials.length && <li className="py-3 text-sm text-slate-600">No testimonials yet.</li>}
        </ul>
      </Card>
      {edit && (
        <Section title={edit.id ? 'Edit testimonial' : 'New testimonial'} busy={s.busy} error={s.error} ok="" onSubmit={save}>
          <TextField label="Name" maxLength={60} required hint={count(edit.name, 60)} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <TextField label="Occasion" maxLength={40} hint={count(edit.occasion, 40)} value={edit.occasion} onChange={(e) => setEdit({ ...edit, occasion: e.target.value })} />
          <TextArea label="Quote" rows={4} maxLength={300} required hint={count(edit.quote, 300)} value={edit.quote} onChange={(e) => setEdit({ ...edit, quote: e.target.value })} />
          <div>
            <label className="text-sm font-medium text-slate-800">Photo (optional)
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {edit.photoUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img src={edit.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                <Button type="button" variant="secondary" size="sm" onClick={() => setEdit({ ...edit, photoUrl: null, photo: undefined, removePhoto: true })}>Remove photo</Button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Published (shown on the site)</label>
          <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
        </Section>
      )}
    </div>
  );
}

function BannerTab({ session, data, reload }: Props) {
  const [f, setF] = useState(data.banner);
  const s = useSaver(session, reload);
  const set = (p: Partial<typeof f>) => { s.clear(); setF({ ...f, ...p }); };
  function submit(e: FormEvent) {
    e.preventDefault();
    if (f.link && !isSafeLink(f.link)) return s.fail('The banner link must start with / or https://');
    s.run({ section: 'banner', ...f });
  }
  return (
    <div className="space-y-4">
      <Section title="Site banner" busy={s.busy} error={s.error} ok={s.ok} onSubmit={submit}>
        <TextField label="Message" maxLength={140} hint={count(f.message, 140)} value={f.message} onChange={(e) => set({ message: e.target.value })} />
        <TextField label="Link (optional)" placeholder="/designs or https://…" value={f.link} onChange={(e) => set({ link: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Start date (optional)" type="date" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
          <TextField label="End date (optional)" type="date" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
      </Section>
      <Card>
        <p className="text-sm font-medium text-slate-800">Preview</p>
        <div className="mt-2 rounded-control bg-brand-800 px-4 py-2 text-center text-sm font-medium text-white">
          {f.message || 'Your message appears here'}{f.link && isSafeLink(f.link) && <span className="ml-2 underline">Learn more</span>}
        </div>
      </Card>
    </div>
  );
}

function ContactTab({ session, data, reload }: Props) {
  const [f, setF] = useState(data.contact);
  const s = useSaver(session, reload);
  const field = (k: keyof typeof f, label: string, extra: { hint?: string; type?: string } = {}) =>
    <TextField label={label} type={extra.type} hint={extra.hint} value={f[k]} onChange={(e) => { s.clear(); setF({ ...f, [k]: e.target.value }); }} />;
  return (
    <Section title="Contact & social" busy={s.busy} error={s.error} ok={s.ok} note="These details also show on the IT pages."
      onSubmit={(e) => { e.preventDefault(); s.run({ section: 'contact', ...f }); }}>
      {field('email', 'Email', { type: 'email' })}
      {field('phone', 'Phone')}
      {field('address', 'Address')}
      {field('hours', 'Working hours')}
      {field('mapEmbedUrl', 'Map embed URL', { hint: 'Must start with https://www.google.com/maps/embed' })}
      {field('facebookUrl', 'Facebook link', { hint: 'https://…' })}
      {field('whatsappUrl', 'WhatsApp link', { hint: 'https://…' })}
      {field('viberUrl', 'Viber link', { hint: 'https://…' })}
    </Section>
  );
}

function BrandingTab({ session, data, reload }: Props) {
  const [f, setF] = useState(data.branding);
  const [logo, setLogo] = useState<string | undefined>();
  const s = useSaver(session, reload);
  const set = (p: Partial<typeof f>) => { s.clear(); setF({ ...f, ...p }); };
  async function pick(file?: File) {
    if (!file) return;
    try {
      const url = await optimizeImage(file, 512, 512, 0.9);
      if (url.length * 0.75 > 500_000) return s.fail('Logo must be 500 KB or smaller.');
      setLogo(url); set({ logoUrl: url });
    } catch (e) { s.fail((e as Error).message); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { logoUrl, ...rest } = f;
    if (await s.run({ section: 'branding', ...rest, logo })) setLogo(undefined);
  }
  return (
    <Section title="Branding" busy={s.busy} error={s.error} ok={s.ok} onSubmit={submit}>
      <TextField label="Company name" maxLength={60} required value={f.companyName} onChange={(e) => set({ companyName: e.target.value })} />
      <TextField label="Tagline" maxLength={120} value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} />
      <Select label="Logo type" value={f.logoType} onChange={(e) => set({ logoType: e.target.value })}>
        <option value="icon">Icon</option>
        <option value="image">Image</option>
      </Select>
      <Select label="Theme colour (emails)" value={f.themeColor} onChange={(e) => set({ themeColor: e.target.value })}>
        {[['deepblue', 'Deep blue'], ['emerald', 'Emerald'], ['slate', 'Slate'], ['indigo', 'Indigo'], ['violet', 'Violet']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <TextField label="Icon name" maxLength={40} required value={f.logoIcon} onChange={(e) => set({ logoIcon: e.target.value })} />
      <div>
        <label className="text-sm font-medium text-slate-800">Logo image (up to 500 KB)
          <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {f.logoUrl && <img src={f.logoUrl} alt="Logo preview" className="mt-2 h-16 w-16 rounded-control border border-slate-200 object-contain" />}
      </div>
    </Section>
  );
}

export default function ContentPage({ session }: { session: Session }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Homepage');
  const [data, setData] = useState<Content | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  async function reload() { const d = await session.api<Content>('/api/admin/content'); if (mounted.current) setData(d); }
  useEffect(() => { mounted.current = true; reload().catch((e: Error) => setError(e.message)); return () => { mounted.current = false; }; }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Content &amp; settings</h1>
      <nav aria-label="Content sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} type="button" id={`tab-${slug(t)}`} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-t-control px-3 py-2 text-sm font-semibold ${tab === t ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100'}`}>{t}</button>
        ))}
      </nav>
      <div className="mt-5">
        {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p>
          : !data ? <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading…</p>
          : <>
            {([
              ['Homepage', HomeTab], ['FAQ', FaqTab], ['Testimonials', TestimonialsTab],
              ['Banner', BannerTab], ['Contact & social', ContactTab], ['Branding', BrandingTab],
            ] as const).map(([name, Tab]) => <div key={name} hidden={tab !== name}><Tab session={session} data={data} reload={reload} /></div>)}
          </>}
      </div>
    </div>
  );
}
