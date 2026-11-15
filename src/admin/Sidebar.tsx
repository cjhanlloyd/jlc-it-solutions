// Admin navigation: collapsible desktop rail and phone drawer.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, BarChart3, CalendarHeart, CreditCard, FileText, Globe, Inbox, LayoutDashboard, Mail, Menu, PanelLeftClose, PanelLeftOpen, Palette, ShoppingBag, UserCog, Users, X, type LucideIcon } from 'lucide-react';
import { isActive, visibleGroups } from './navConfig';

const COLLAPSE_KEY = 'jlc_admin_nav_collapsed';
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, reports: BarChart3, orders: ShoppingBag, customers: Users, inquiries: Inbox, invitations: CalendarHeart,
  designs: Palette, content: FileText, itContent: Globe, users: UserCog, activity: Activity, payment: CreditCard, email: Mail,
};
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function NavList({ role, page, collapsed, onNavigate }: { role: string; page: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto p-2">
      {visibleGroups(role).map((g, gi) => (
        <div key={g.label} className={gi > 0 ? 'mt-3' : ''}>
          {collapsed
            ? gi > 0 && <hr aria-hidden="true" className="mx-2 mb-2 border-slate-200" />
            : <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{g.label}</h2>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(page, it);
              const Icon = ICONS[it.id];
              return (
                <li key={it.id}>
                  <a
                    href={it.href}
                    onClick={onNavigate}
                    title={collapsed ? it.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm font-semibold ${collapsed ? 'justify-center' : ''} ${active ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100'} ${focusRing}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={collapsed ? 'sr-only' : ''}>{it.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Wraps the page content: desktop rail on the left, phone top bar with a menu button and drawer.
export default function Sidebar({ role, page, userBar, children }: { role: string; page: string; userBar: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  function toggle() {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1'); } catch { /* storage unavailable */ }
    setCollapsed(!collapsed);
  }

  // Drawer: focus moves in, Tab is trapped, Escape closes and returns focus to the menu button, body scroll is locked (same as the public Navbar).
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current!;
    const focusable = (): HTMLElement[] => Array.from(sheet.querySelectorAll('a[href], button:not([disabled])'));
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      const first = els[0], last = els[els.length - 1];
      const outside = !sheet.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || outside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || outside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    // Growing to md or wider hides the drawer: close it so the scroll lock and focus trap go with it
    const mq = window.matchMedia('(min-width: 768px)');
    const onMq = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener('change', onMq);
    window.addEventListener('resize', onMq); // some browsers and emulators skip the media-query change event
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', onMq);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      toggleRef.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  // Back or a hash change swaps the page: close the drawer (a no-op when already closed)
  useEffect(() => setOpen(false), [page]);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 motion-reduce:transition-none md:sticky md:top-0 md:flex md:h-screen ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex items-center p-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <p className="px-1 font-display text-lg font-bold text-brand-800">JLC Admin</p>}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={`rounded-control p-2 text-slate-700 hover:bg-slate-100 ${focusRing}`}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        <NavList role={role} page={page} collapsed={collapsed} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 md:justify-end md:py-3">
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="admin-drawer"
            className={`rounded-control p-2 text-slate-700 hover:bg-slate-100 md:hidden ${focusRing}`}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <p className="font-display text-lg font-bold text-brand-800 md:hidden">JLC Admin</p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{userBar}</div>
        </header>
        {children}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={close} aria-hidden="true" />
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Admin menu" id="admin-drawer" className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between p-3">
              <p className="px-1 font-display text-lg font-bold text-brand-800">JLC Admin</p>
              <button type="button" onClick={close} aria-label="Close menu" className={`rounded-control p-2 text-slate-700 hover:bg-slate-100 ${focusRing}`}>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <NavList role={role} page={page} collapsed={false} onNavigate={close} />
          </div>
        </div>
      )}
    </div>
  );
}
