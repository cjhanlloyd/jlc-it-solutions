// Portal API helpers: the old admin's JSON helper plus the signed-in session passed to every page.
export { adminApi } from '../components/admin/api';

export type AdminUser = { email: string; role: string; fullName: string };
export type Session = {
  user: AdminUser;
  signOut: () => void; // for callers that bypass api() (the moved IT editors)
  token: string; // for the moved IT editors, which call the old adminApi helper directly
  // JSON GET (no body) or POST; throws Error with the server's message. A 401 signs out first.
  api: <T = any>(path: string, body?: unknown) => Promise<T>;
  // An authenticated image (receipts) as a data: URL; the site CSP allows data: images but not blob:.
  image: (path: string) => Promise<string>;
};

export const fmtManila = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—');
// The stored role 'Editor' is shown as "Designer" everywhere in the portal
export const roleLabel = (role: string) => (role === 'Editor' ? 'Designer' : role);
export const fmtDate =(s: string | null | undefined) => (s ? new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
