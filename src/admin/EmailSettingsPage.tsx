// Email settings: SMTP, the auto-reply template, and a test send.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Spinner, TextArea, TextField } from '../ui';
import type { Session } from './api';

type Smtp = { host: string; port: string; username: string; senderName: string; senderEmail: string; signature: string; enabled: boolean };
type Res = { smtp: Omit<Smtp, 'port'> & { port: number; passwordSet: boolean }; template: { subject: string; body: string } };
type Msg = { ok: boolean; text: string } | null;

function Result({ m }: { m: Msg }) {
  if (!m) return null;
  return m.ok ? <p role="status" className="text-sm font-medium text-emerald-800">{m.text}</p> : <p role="alert" className="text-sm font-medium text-red-700">{m.text}</p>;
}

export default function EmailSettingsPage({ session }: { session: Session }) {
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [passwordSet, setPasswordSet] = useState(false);
  const [password, setPassword] = useState('');
  const [clear, setClear] = useState(false);
  const [tpl, setTpl] = useState({ subject: '', body: '' });
  const [loadError, setLoadError] = useState('');
  const [smtpMsg, setSmtpMsg] = useState<Msg>(null);
  const [tplMsg, setTplMsg] = useState<Msg>(null);
  const [testMsg, setTestMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    session.api<Res>('/api/admin/email').then((d) => {
      setSmtp({ ...d.smtp, port: String(d.smtp.port) });
      setPasswordSet(d.smtp.passwordSet);
      setTpl(d.template);
    }).catch((e: Error) => setLoadError(e.message));
  }, [session]);

  async function post(key: string, body: object, setMsg: (m: Msg) => void, okText: (r: any) => string) {
    setBusy(key); setMsg(null);
    try {
      const r = await session.api<any>('/api/admin/email', body);
      setMsg({ ok: true, text: okText(r) });
      return r;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally { setBusy(''); }
  }

  async function saveSmtp(e: FormEvent) {
    e.preventDefault();
    if (!smtp) return;
    if (!/^\d+$/.test(smtp.port.trim())) return setSmtpMsg({ ok: false, text: 'Port must be a number.' });
    const r = await post('smtp', { section: 'smtp', ...smtp, port: Number(smtp.port), ...(password && { password }), clearPassword: clear }, setSmtpMsg, () => 'SMTP settings saved.');
    if (r) { setPasswordSet(r.passwordSet); setPassword(''); setClear(false); }
  }

  if (loadError) return <p role="alert" className="text-sm font-medium text-red-700">{loadError}</p>;
  if (!smtp) return <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading email settings…</p>;
  const up = (patch: Partial<Smtp>) => setSmtp({ ...smtp, ...patch });

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Email settings</h1>
      <Card>
        <h2 className="font-display text-lg font-semibold">SMTP</h2>
        <form onSubmit={saveSmtp} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
            <input type="checkbox" checked={smtp.enabled} onChange={(e) => up({ enabled: e.target.checked })} className="h-4 w-4" /> Send email through SMTP
          </label>
          <TextField label="Host" required value={smtp.host} onChange={(e) => up({ host: e.target.value })} />
          <TextField label="Port" required type="number" min={1} max={65535} step={1} value={smtp.port} onChange={(e) => up({ port: e.target.value })} />
          <TextField label="Username" autoComplete="off" value={smtp.username} onChange={(e) => up({ username: e.target.value })} />
          <div>
            <TextField label="Password" type="password" autoComplete="new-password" value={password} disabled={clear}
              placeholder={passwordSet ? 'Saved — leave blank to keep' : ''} onChange={(e) => setPassword(e.target.value)} />
            {passwordSet && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} className="h-4 w-4" /> Clear saved password
              </label>
            )}
          </div>
          <TextField label="Sender name" maxLength={100} value={smtp.senderName} onChange={(e) => up({ senderName: e.target.value })} />
          <TextField label="Sender email" type="email" required value={smtp.senderEmail} onChange={(e) => up({ senderEmail: e.target.value })} />
          <div className="sm:col-span-2">
            <TextArea label="Signature" rows={3} maxLength={1000} hint={`${smtp.signature.length}/1000`} value={smtp.signature} onChange={(e) => up({ signature: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" loading={busy === 'smtp'}>Save SMTP settings</Button>
            <Button variant="secondary" loading={busy === 'test'} onClick={() => post('test', { section: 'test' }, setTestMsg, (r) => `Test email sent to ${r.sentTo}.`)}>Send test email</Button>
          </div>
          <div className="space-y-1 sm:col-span-2"><Result m={smtpMsg} /><Result m={testMsg} /></div>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Auto-reply template</h2>
        <form onSubmit={(e) => { e.preventDefault(); post('tpl', { section: 'template', ...tpl }, setTplMsg, () => 'Template saved.'); }} className="mt-4 space-y-4">
          <TextField label="Subject" required maxLength={150} hint={`${tpl.subject.length}/150`} value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} />
          <TextArea label="Body" required rows={10} maxLength={5000} hint={`${tpl.body.length}/5000`} value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} />
          <p className="text-sm text-slate-700">
            Placeholders filled in on each inquiry: {['name', 'service', 'projectDescription', 'preferredContact', 'companyEmail', 'companyPhone'].map((p) => `{{${p}}}`).join(' ')}
          </p>
          <Button type="submit" loading={busy === 'tpl'}>Save template</Button>
          <Result m={tplMsg} />
        </form>
      </Card>
    </section>
  );
}
