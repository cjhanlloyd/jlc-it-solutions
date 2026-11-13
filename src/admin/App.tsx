// Admin portal shell (/admin): sign-in, sidebar and hash routes #/orders, #/orders/<id>, #/settings/payment.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { can } from '../../server/permissions';
import { Button, Card, TextField } from '../ui';
import { adminApi, type AdminUser, type Session } from './api';
import OrderDetail from './OrderDetail';
import OrdersPage from './OrdersPage';
import PaymentSettingsPage from './PaymentSettingsPage';

// Same keys as the old admin in src/App.tsx, so one sign-in serves both
const TOKEN_KEY = 'jlc_admin_token';
const USER_KEY = 'jlc_admin_user';

function loadSaved(): { token: string; user: AdminUser } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    return token && user?.email ? { token, user } : null;
  } catch {
    return null;
  }
}

type Route = { page: 'orders' } | { page: 'order'; id: number } | { page: 'settings' };
function parseRoute(hash: string): Route | null {
  if (hash === '#/orders') return { page: 'orders' };
  if (hash === '#/settings/payment') return { page: 'settings' };
  const id = hash.match(/^#\/orders\/(\d+)$/)?.[1];
  return id ? { page: 'order', id: Number(id) } : null;
}

function useHashRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!parseRoute(hash)) window.location.replace('#/orders'); }, [hash]);
  return parseRoute(hash) ?? { page: 'orders' };
}

function Login({ onDone }: { onDone: (token: string, user: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid login details.');
      onDone(data.token, { email: data.email, role: data.role, fullName: data.fullName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server error. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-xl font-bold text-slate-900">JLC Admin</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to manage orders.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}

const navCls = (active: boolean) => `whitespace-nowrap rounded-control px-3 py-2 text-sm font-semibold ${active ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100'}`;

export default function App() {
  const [saved, setSaved] = useState(loadSaved);
  const route = useHashRoute();

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setSaved(null);
  }, []);

  const session: Session | null = useMemo(() => {
    if (!saved) return null;
    const unauthorized = (status: number) => { if (status === 401) signOut(); };
    return {
      user: saved.user,
      api: async (path, body) => {
        try {
          return await adminApi(path, saved.token, body, 'Something went wrong. Please try again.');
        } catch (e: any) {
          unauthorized(e?.status);
          throw e;
        }
      },
      image: async (path) => {
        const res = await fetch(path, { headers: { Authorization: `Bearer ${saved.token}` } });
        unauthorized(res.status);
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'The image could not be loaded.');
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('The image could not be read.'));
          reader.readAsDataURL(blob);
        });
      },
    };
  }, [saved, signOut]);

  if (!session) {
    return <Login onDone={(token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setSaved({ token, user });
    }} />;
  }

  const { user } = session;
  const paymentSettings = can(user.role, 'settings.payment');
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <p className="px-4 pt-4 font-display text-lg font-bold text-brand-800">JLC Admin</p>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          <a href="#/orders" className={navCls(route.page !== 'settings')} aria-current={route.page !== 'settings' ? 'page' : undefined}>Orders</a>
          {paymentSettings && <a href="#/settings/payment" className={navCls(route.page === 'settings')} aria-current={route.page === 'settings' ? 'page' : undefined}>Payment settings</a>}
          <a href="/#/admin" className={navCls(false)}>Designs &amp; content (old admin)</a>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-slate-700"><span className="font-semibold">{user.fullName || user.email}</span> · {user.role}</span>
          <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          {route.page === 'orders' && <OrdersPage session={session} />}
          {route.page === 'order' && <div key={route.id}><OrderDetail session={session} id={route.id} /></div>}
          {route.page === 'settings' && (paymentSettings ? <PaymentSettingsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot change payment settings.</p>)}
        </main>
      </div>
    </div>
  );
}
