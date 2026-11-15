// Users: invite form and a table with state-dependent row actions.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, EmptyState, Select, Spinner, TextField } from '../ui';
import { fmtManila, roleLabel, type Session } from './api';

type User = { email: string; fullName: string; role: string; status: string; verified: boolean; createdAt: string };
const ROLES = ['Super Admin', 'Administrator', 'Editor'];

export default function UsersPage({ session }: { session: Session }) {
  const [data, setData] = useState<{ users: User[]; me: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', role: 'Editor' });
  const linkRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => session.api<{ users: User[]; me: string }>('/api/admin/users').then(setData).catch((e: Error) => setError(e.message)), [session]);
  useEffect(() => { load(); }, [load]);

  async function run(key: string, path: string, body: unknown) {
    setBusy(key); setError(''); setNotice(''); setLink('');
    try {
      const r = await session.api<{ emailed?: boolean; inviteLink?: string }>(path, body);
      if (r.inviteLink) setLink(r.inviteLink);
      else if (r.emailed) setNotice('Email sent.');
      else { setError('The email could not be sent. Check Email settings.'); return true; }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy('');
      await load();
    }
  }
  const act = (u: User, action: string, extra: object = {}) => run(u.email + action, `/api/admin/users/${encodeURIComponent(u.email)}`, { action, ...extra });

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (await run('invite', '/api/admin/users', { action: 'invite', ...form })) setForm({ fullName: '', email: '', role: 'Editor' });
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setNotice('Link copied.'); }
    catch { linkRef.current?.select(); }
  }

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Users</h1>
      <form onSubmit={invite} className="mt-4 grid items-end gap-3 rounded-card border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_12rem_auto]">
        <TextField label="Full name" required maxLength={80} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </Select>
        <Button type="submit" loading={busy === 'invite'}>Invite</Button>
      </form>

      {link && (
        <div className="mt-4 rounded-card border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-800">Email is off — send this link yourself</p>
          <div className="mt-2 flex gap-2">
            <input ref={linkRef} readOnly aria-label="Invite link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-control border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900" />
            <Button variant="secondary" onClick={copy}>Copy</Button>
            <Button variant="secondary" onClick={() => setLink('')}>Dismiss</Button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mt-4 text-sm font-medium text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!data && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading users…</p>}
      {data && (data.users.length === 0 ? <div className="mt-6"><EmptyState title="No users" /></div> : (
        <div className="mt-4 overflow-x-auto rounded-card border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => {
                const self = u.email.toLowerCase() === data.me.toLowerCase();
                const active = u.status === 'Active' && u.verified;
                const status = u.status === 'Disabled' ? 'Disabled' : !u.verified ? 'Invited' : u.status;
                return (
                  <tr key={u.email}>
                    <td className="px-4 py-3"><div className="font-semibold">{u.fullName}</div><div className="text-xs text-slate-600">{u.email}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {active && !self ? (
                        <select aria-label={`Role for ${u.email}`} value={u.role} disabled={!!busy} onChange={(e) => act(u, 'role', { role: e.target.value })} className="rounded-control border border-slate-300 bg-white px-2 py-1.5 text-sm">
                          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                      ) : roleLabel(u.role)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{status}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtManila(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {self ? <span className="font-semibold text-slate-700">You</span> : (
                        <div className="flex flex-wrap gap-2">
                          {active && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act(u, 'disable')}>Disable</Button>}
                          {active && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act(u, 'send-reset')}>Send reset</Button>}
                          {u.status === 'Disabled' && u.verified && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act(u, 'enable')}>Enable</Button>}
                          {!u.verified && u.status !== 'Disabled' && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act(u, 'resend-invite')}>Resend invite</Button>}
                          <Button size="sm" variant="danger" disabled={!!busy} onClick={() => { if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) act(u, 'delete'); }}>Delete</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
