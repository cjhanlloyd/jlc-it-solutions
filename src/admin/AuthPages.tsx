// Signed-out portal pages: #/forgot, #/invite?email=&token=, #/reset?email=&token=
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Card, TextField } from '../ui';

async function post(path: string, body: object): Promise<string> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data.message || '';
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-xl font-bold text-slate-900">{title}</h1>
        {children}
      </Card>
    </main>
  );
}

const linkCls = 'text-sm font-semibold text-brand-800 underline';

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setMessage(await post('/api/admin/forgot-password', { email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server error. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Reset your password">
      {message ? <p role="status" className="mt-4 text-sm text-slate-700">{message}</p> : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-4"><a href="#/" className={linkCls}>Back to sign in</a></p>
    </Shell>
  );
}

export function SetPasswordPage({ mode, email, token }: { mode: 'invite' | 'reset'; email: string; token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await post(mode === 'invite' ? '/api/admin/verify-invite' : '/api/admin/reset-password', { email, token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server error. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title={mode === 'invite' ? 'Set up your account' : 'Choose a new password'}>
      {done ? (
        <p role="status" className="mt-4 text-sm text-slate-700">Password set — <a href="#/" className={linkCls}>sign in</a></p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <p className="text-sm text-slate-600">{email}</p>
          <TextField label="New password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" required minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Set password</Button>
        </form>
      )}
    </Shell>
  );
}
