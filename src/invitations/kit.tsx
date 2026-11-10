// Pieces shared by the main-site invitation pages (catalog, customiser, success, manage, policies).
import React from 'react';
import * as Icons from 'lucide-react';
import { LIMITS } from '../../shared/invitation-fields';
import { optimizeImage } from '../components/admin/images';

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

export const peso = (centavos: number) =>
  `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// The layouts use the same Google Fonts as invitation.html; load them once so previews match the guest page.
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;700&display=swap';
export function useInvitationFonts() {
  React.useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

// Cloudflare Turnstile, same pattern as src/components/InquiryForm.tsx. On localhost, use Cloudflare's always-pass test key.
const TURNSTILE_SITE_KEY = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAF6Se95DZhEd5led';

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  return (turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve();
    script.onerror = () => { turnstileScript = null; reject(new Error('Turnstile failed to load')); };
    document.head.appendChild(script);
  }));
}

// Returns the widget's ref callback, the current token, a load error and a reset (call it after a failed submit).
export function useTurnstile() {
  const [token, setToken] = React.useState('');
  const [error, setError] = React.useState('');
  const widgetId = React.useRef<string | null>(null);
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let unmounted = false;
    loadTurnstile().then(() => {
      if (unmounted) return;
      widgetId.current = (window as any).turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => { setToken(t); setError(''); },
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    }).catch(() => setError('The anti-spam check could not load. Please disable content blockers for this site and reload.'));
    return () => {
      unmounted = true;
      if (widgetId.current) (window as any).turnstile?.remove(widgetId.current);
      widgetId.current = null;
      setToken('');
    };
  }, []);
  const reset = () => {
    setToken('');
    if (widgetId.current) (window as any).turnstile?.reset(widgetId.current);
  };
  return { ref, token, error, reset };
}

export const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-500';
export const labelCls = 'text-xs font-bold text-slate-700 uppercase tracking-wider font-display block mb-1.5';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && !error && <span className="text-[11px] text-slate-400 block mt-1">{hint}</span>}
      {error && <span className="text-xs text-red-600 block mt-1">{error}</span>}
    </label>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls = { error: 'bg-red-50 border-red-100 text-red-700', success: 'bg-emerald-50 border-emerald-100 text-emerald-800', info: 'bg-slate-50 border-slate-200 text-slate-700' }[kind];
  const Icon = { error: Icons.AlertCircle, success: Icons.CheckCircle, info: Icons.Info }[kind];
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

const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,/;
// photos holds data URLs (new) and, on the manage page, R2 keys (already uploaded); src() turns either into an <img> src.
export const photoSrc = (p: string) => (p.startsWith('data:') ? p : `/photos/${p}`);

export function PhotoPicker({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, LIMITS.photos - photos.length)) {
      try {
        const url = await optimizeImage(f);
        if (!PHOTO_RE.test(url)) setError('Please use JPEG, PNG or WebP photos.');
        else if (url.length > LIMITS.photoChars) setError('One photo is too large even after compressing. Please pick a smaller one.');
        else added.push(url);
      } catch {
        setError('We could not read one of the photos. Please use JPEG or PNG photos.');
      }
    }
    if (files.length > LIMITS.photos - photos.length) setError(`You can add up to ${LIMITS.photos} photos.`);
    onChange([...photos, ...added]);
    setBusy(false);
  };
  return (
    <fieldset className="space-y-3 border-t border-slate-200 pt-6">
      <legend className="text-sm font-extrabold text-slate-900 font-display pr-3">Photos (up to {LIMITS.photos})</legend>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p.slice(-40) + i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
            <img src={photoSrc(p)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} className="absolute top-1 right-1 p-1.5 rounded-full bg-white/90 text-slate-700 hover:text-red-600 cursor-pointer" aria-label={`Remove photo ${i + 1}`}>
              <Icons.X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {photos.length < LIMITS.photos && (
          <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 flex flex-col items-center justify-center text-slate-500 text-xs font-bold cursor-pointer text-center p-2">
            <Icons.ImagePlus className="h-6 w-6 mb-1" />
            {busy ? 'Adding…' : 'Add photos'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}

// Phone-only Edit / Preview switch; on large screens both panes show side by side.
export function PaneToggle({ view, setView }: { view: 'edit' | 'preview'; setView: (v: 'edit' | 'preview') => void }) {
  return (
    <div className="lg:hidden sticky top-20 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-2 flex gap-2" role="tablist">
      {(['edit', 'preview'] as const).map((v) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); window.scrollTo({ top: 0 }); }}
          className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider font-display cursor-pointer ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'}`}>
          {v === 'edit' ? 'Edit' : 'Preview'}
        </button>
      ))}
    </div>
  );
}
