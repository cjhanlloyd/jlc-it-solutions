// IT pages (#/it-content): the old IT content editors (home, about, services, pricing, why-us), moved as they were.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../components/admin/api';
import type { AdminRole, WebsiteData } from '../types';
import { Spinner } from '../ui';
import type { Session } from './api';
import ContentTab from './it-content/ContentTab';

export default function ItContentPage({ session }: { session: Session }) {
  const [db, setDb] = useState<WebsiteData | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    adminApi('/api/admin/data', session.token, undefined, 'Failed to load IT content.').then((d) => setDb(d.db)).catch((e: Error & { status?: number }) => { if (e.status === 401) session.signOut(); else setError(e.message); });
    return () => clearTimeout(timer.current);
  }, [session]);

  const showFlashMsg = useCallback((msg: string) => { setFlash(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setFlash(''), 4000); }, []);
  const run = useCallback(async (task: () => Promise<void>, ok?: string) => {
    setIsSaving(true); setError('');
    try { await task(); if (ok) showFlashMsg(ok); } catch (e) { if ((e as { status?: number }).status === 401) session.signOut(); else setError((e as Error).message); } finally { setIsSaving(false); }
  }, [showFlashMsg, session]);

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">IT pages</h1>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {flash && <p role="status" className="mt-4 text-sm font-medium text-emerald-800">{flash}</p>}
      {!db && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading…</p>}
      {db && (
        <div className="mt-4">
          <ContentTab db={db} setDb={setDb} adminToken={session.token} adminUser={{ ...session.user, role: session.user.role as AdminRole }}
            isSaving={isSaving} run={run} showFlashMsg={showFlashMsg} setApiError={setError} />
        </div>
      )}
    </section>
  );
}
