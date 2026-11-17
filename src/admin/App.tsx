// Admin portal shell (/admin): sign-in, sidebar and hash routes #/dashboard, #/orders, #/orders/<id>, #/inquiries, #/inquiries/<id>, #/customers, #/customers/<id>, #/designs, #/designs/new, #/designs/<id>, #/settings/payment.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { can } from '../../server/permissions';
import { Button, Card, TextField } from '../ui';
import { adminApi, roleLabel, type AdminUser, type Session } from './api';
import ActivityPage from './ActivityPage';
import EmailSettingsPage from './EmailSettingsPage';
import UsersPage from './UsersPage';
import { ForgotPage, SetPasswordPage } from './AuthPages';
import ContentPage from './ContentPage';
import CustomerDetail from './CustomerDetail';
import CustomersPage from './CustomersPage';
import DashboardPage from './DashboardPage';
import DesignEditor from './DesignEditor';
import DesignsPage from './DesignsPage';
import MusicPage from './MusicPage';
import PromosPage from './PromosPage';
import ReviewsPage from './ReviewsPage';
import InvitationsPage from './InvitationsPage';
import ItContentPage from './ItContentPage';
import InquiriesPage from './InquiriesPage';
import InquiryDetail from './InquiryDetail';
import OrderDetail from './OrderDetail';
import OrdersPage from './OrdersPage';
import PaymentSettingsPage from './PaymentSettingsPage';
import ReportsPage from './ReportsPage';
import Sidebar from './Sidebar';

// localStorage keys of the admin sign-in
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

type Route = { page: 'dashboard' } | { page: 'orders' } | { page: 'reports' } | { page: 'order'; id: number } | { page: 'settings' } | { page: 'users' } | { page: 'activity' } | { page: 'emailSettings' } | { page: 'content' } | { page: 'invitations' } | { page: 'itContent' } | { page: 'designs' } | { page: 'music' } | { page: 'promos' } | { page: 'reviews' } | { page: 'design'; id: number | null }
  | { page: 'inquiries' } | { page: 'inquiry'; id: string } | { page: 'customers' } | { page: 'customer'; id: number }
  | { page: 'forgot' } | { page: 'invite' | 'reset'; email: string; token: string };
function parseRoute(hash: string): Route | null {
  if (hash === '#/forgot') return { page: 'forgot' };
  const auth = hash.match(/^#\/(invite|reset)\?(.*)$/);
  if (auth) {
    const q = new URLSearchParams(auth[2]);
    return { page: auth[1] as 'invite' | 'reset', email: q.get('email') ?? '', token: q.get('token') ?? '' };
  }
  if (hash === '#/dashboard') return { page: 'dashboard' };
  if (hash === '#/orders') return { page: 'orders' };
  if (hash === '#/reports') return { page: 'reports' };
  if (hash === '#/settings/payment') return { page: 'settings' };
  if (hash === '#/users') return { page: 'users' };
  if (hash === '#/activity') return { page: 'activity' };
  if (hash === '#/settings/email') return { page: 'emailSettings' };
  if (hash === '#/content') return { page: 'content' };
  if (hash === '#/invitations') return { page: 'invitations' };
  if (hash === '#/it-content') return { page: 'itContent' };
  if (hash === '#/designs') return { page: 'designs' };
  if (hash === '#/music') return { page: 'music' };
  if (hash === '#/promos') return { page: 'promos' };
  if (hash === '#/reviews') return { page: 'reviews' };
  if (hash === '#/designs/new') return { page: 'design', id: null };
  if (hash === '#/inquiries') return { page: 'inquiries' };
  if (hash === '#/customers') return { page: 'customers' };
  let inquiryId = hash.match(/^#\/inquiries\/([^/]+)$/)?.[1];
  try { if (inquiryId) inquiryId = decodeURIComponent(inquiryId); } catch { inquiryId = undefined; } // malformed escape falls through to null
  if (inquiryId) return { page: 'inquiry', id: inquiryId };
  const customerId = hash.match(/^#\/customers\/(\d+)$/)?.[1];
  if (customerId) return { page: 'customer', id: Number(customerId) };
  const designId = hash.match(/^#\/designs\/(\d+)$/)?.[1];
  if (designId) return { page: 'design', id: Number(designId) };
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
  useEffect(() => { if (!parseRoute(hash)) window.location.replace('#/dashboard'); }, [hash]);
  return parseRoute(hash) ?? { page: 'dashboard' };
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
        <p className="mt-4"><a href="#/forgot" className="text-sm font-semibold text-brand-800 underline">Forgot password?</a></p>
      </Card>
    </main>
  );
}

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
      token: saved.token,
      signOut,
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

  const authPage = route.page === 'forgot' || route.page === 'invite' || route.page === 'reset';
  // A signed-in user opening an invite/reset/forgot link is signed out locally first
  useEffect(() => { if (authPage && saved) signOut(); }, [authPage, saved, signOut]);

  if (route.page === 'forgot') return <ForgotPage />;
  if (route.page === 'invite' || route.page === 'reset') return <div key={route.page + route.token}><SetPasswordPage mode={route.page} email={route.email} token={route.token} /></div>;

  if (!session) {
    return <Login onDone={(token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setSaved({ token, user });
    }} />;
  }

  const { user } = session;
  const paymentSettings = can(user.role, 'settings.payment');
  const manageDesigns = can(user.role, 'designs.manage');
  const managePromos = can(user.role, 'promos.manage');
  const manageReviews = can(user.role, 'reviews.manage');
  const manageUsers = can(user.role, 'users.manage');
  const viewActivity = can(user.role, 'activity.view');
  const emailSettings = can(user.role, 'settings.email');
  const manageContent = can(user.role, 'content.manage');
  const viewOrders = can(user.role, 'orders.view');
  const manageInquiries = can(user.role, 'inquiries.manage');
  const viewCustomers = can(user.role, 'customers.view');
  const viewReports = can(user.role, 'reports.view');
  return (
    <Sidebar role={user.role} page={route.page} userBar={<>
      <span className="text-sm text-slate-700"><span className="font-semibold">{user.fullName || user.email}</span> · {roleLabel(user.role)}</span>
      <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
    </>}>
        <main className="mx-auto max-w-screen-2xl p-4 md:p-6">
          {route.page === 'dashboard' && <DashboardPage session={session} />}
          {route.page === 'orders' && <OrdersPage session={session} />}
          {route.page === 'order' && <div key={route.id}><OrderDetail session={session} id={route.id} /></div>}
          {route.page === 'reports' && (viewReports ? <ReportsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot view reports.</p>)}
          {route.page === 'inquiries' && (manageInquiries ? <InquiriesPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage inquiries.</p>)}
          {route.page === 'inquiry' && (manageInquiries ? <div key={route.id}><InquiryDetail session={session} id={route.id} /></div> : <p className="text-sm text-slate-700">Your role cannot manage inquiries.</p>)}
          {route.page === 'customers' && (viewCustomers ? <CustomersPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot view customers.</p>)}
          {route.page === 'customer' && (viewCustomers ? <div key={route.id}><CustomerDetail session={session} id={route.id} /></div> : <p className="text-sm text-slate-700">Your role cannot view customers.</p>)}
          {route.page === 'designs' && (manageDesigns ? <DesignsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage designs.</p>)}
          {route.page === 'music' && (manageDesigns ? <MusicPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage music.</p>)}
          {route.page === 'promos' && (managePromos ? <PromosPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage promo codes.</p>)}
          {route.page === 'reviews' && (manageReviews ? <ReviewsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage reviews.</p>)}
          {route.page === 'design' && (manageDesigns ? <div key={route.id ?? 'new'}><DesignEditor session={session} id={route.id} /></div> : <p className="text-sm text-slate-700">Your role cannot manage designs.</p>)}
          {route.page === 'content' && (manageContent ? <ContentPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage content.</p>)}
          {route.page === 'invitations' && (viewOrders ? <InvitationsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot view invitations.</p>)}
          {route.page === 'itContent' && (manageContent ? <ItContentPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage content.</p>)}
          {route.page === 'users' && (manageUsers ? <UsersPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot manage users.</p>)}
          {route.page === 'activity' && (viewActivity ? <ActivityPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot view activity.</p>)}
          {route.page === 'emailSettings' && (emailSettings ? <EmailSettingsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot change email settings.</p>)}
          {route.page === 'settings' && (paymentSettings ? <PaymentSettingsPage session={session} /> : <p className="text-sm text-slate-700">Your role cannot change payment settings.</p>)}
        </main>
    </Sidebar>
  );
}
