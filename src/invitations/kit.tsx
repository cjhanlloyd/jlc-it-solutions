// Pieces shared by the main-site invitation pages (catalog, customiser, success, manage, policies).
import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

// Client-side navigation for real-path pages: App listens to popstate and re-renders.
export function go(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Link({ href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(href);
      }}
    />
  );
}

export { peso } from './event-view';

// The layouts use the same Google Fonts as invitation.html; load them once so previews match the guest page.
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Fredoka:wght@500;700&family=Jost:wght@300;400;500;700&display=swap';
export function useInvitationFonts() {
  React.useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

export { useTurnstile } from './turnstile';

export const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-500';
export const labelCls = 'text-xs font-bold text-slate-700 uppercase tracking-wider font-display block mb-1.5';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && !error && <span className="text-[11px] text-slate-600 block mt-1">{hint}</span>}
      {error && <span role="alert" className="text-xs text-red-600 block mt-1">{error}</span>}
    </label>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls = { error: 'bg-red-50 border-red-100 text-red-700', success: 'bg-emerald-50 border-emerald-100 text-emerald-800', info: 'bg-slate-50 border-slate-200 text-slate-700' }[kind];
  const Icon = { error: AlertCircle, success: CheckCircle, info: Info }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`p-3 border rounded-xl text-sm flex items-start gap-2 ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-slate-200 pt-6">
      <legend className="text-sm font-extrabold text-slate-900 font-display pr-3">{title}</legend>
      {children}
    </fieldset>
  );
}

// photos holds data URLs (new) and, on the manage page, R2 keys (already uploaded); src() turns either into an <img> src.
export const photoSrc = (p: string) => (p.startsWith('data:') ? p : `/photos/${p}`);

// Phone-only Edit / Preview switch; on large screens both panes show side by side.
export function PaneToggle({ view, setView }: { view: 'edit' | 'preview'; setView: (v: 'edit' | 'preview') => void }) {
  return (
    <div className="lg:hidden sticky top-20 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-2 flex gap-2" role="group">
      {(['edit', 'preview'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); window.scrollTo({ top: 0 }); }}
          className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider font-display cursor-pointer ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'}`}>
          {v === 'edit' ? 'Edit' : 'Preview'}
        </button>
      ))}
    </div>
  );
}
