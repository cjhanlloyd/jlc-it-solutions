/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Menu, UserRound, X } from 'lucide-react';
import { StoredIcon } from './StoredIcon';
import { BrandingSettings } from '../types.js';
import { NavLink, navTo } from '../site/NavLink';
import type { Route } from '../site/routes';

interface NavbarProps {
  branding: BrandingSettings;
  page: Route['page'];
  onAdminClick: () => void;
}

export default function Navbar({ branding, page, onAdminClick }: NavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Hidden Admin Portal Click Counter
  const [logoClicks, setLogoClicks] = React.useState(0);
  const [lastClickTime, setLastClickTime] = React.useState(0);

  const handleLogoClick = () => {
    navTo('/');
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      const nextClicks = logoClicks + 1;
      setLogoClicks(nextClicks);
      if (nextClicks >= 4) { // 5 consecutive clicks
        setLogoClicks(0);
        onAdminClick();
      }
    } else {
      setLogoClicks(1);
    }
    setLastClickTime(now);
  };


  const items: { href: string; label: string; active: boolean }[] = [
    { href: '/designs', label: 'Designs', active: ['designs', 'design', 'customise'].includes(page) },
    { href: '/#how', label: 'How it works', active: false },
    { href: '/track', label: 'Track order', active: page === 'track' || page === 'order' },
    { href: '/services', label: 'Other services', active: page === 'services' },
    { href: '/contact', label: 'Contact', active: page === 'contact' },
  ];
  const idOf = (href: string) => href.replace(/[^a-z]/g, '') || 'home';
  // Desktop shows it as an icon link beside the CTA (the text list is full at md); the mobile sheet lists it.
  const account = { href: '/account', label: 'My account', active: page === 'account' };

  const close = () => setIsOpen(false);

  // Mobile sheet: focus moves in, Tab is trapped, Escape closes and returns focus to the toggle, body scroll is locked.
  React.useEffect(() => {
    if (!isOpen) return;
    const sheet = sheetRef.current!;
    const focusable = (): HTMLElement[] => Array.from(sheet.querySelectorAll('a[href], button:not([disabled])'));
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      const first = els[0], last = els[els.length - 1];
      const outside = !sheet.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || outside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || outside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      toggleRef.current?.focus();
    };
  }, [isOpen]);

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const cta = `inline-flex items-center justify-center gap-2 rounded-control bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 ${focusRing}`;
  const underline = 'underline decoration-gold decoration-2 underline-offset-8';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gold-light bg-ivory" id="app-navbar">
      <nav aria-label="Main" className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={handleLogoClick} className={`flex cursor-pointer items-center gap-3 text-left ${focusRing}`} id="logo-button" aria-label={`${branding.companyName} home`}>
          {branding.logoType === 'icon' && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700">
              <StoredIcon name={branding.logoIcon} fallback={Activity} className="h-5 w-5 text-white" />
            </span>
          )}
          {branding.logoType === 'image' && branding.logoImageBase64 ? (
            <img src={branding.logoImageBase64} alt="" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
          ) : null}
          <span className="font-serif text-2xl font-semibold leading-none tracking-tight text-ink">{branding.companyName}</span>
        </button>

        <ul className="hidden items-center gap-8 md:flex">
          {items.map((it) => (
            <li key={it.href}>
              <NavLink
                href={it.href}
                aria-current={it.active ? 'page' : undefined}
                className={`py-2 text-sm font-medium text-ink hover:underline hover:decoration-gold hover:decoration-2 hover:underline-offset-8 ${it.active ? underline : ''} ${focusRing}`}
                id={`nav-item-${idOf(it.href)}`}
              >
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <NavLink href={account.href} aria-current={account.active ? 'page' : undefined} aria-label="My account" title="My account" id="nav-item-account"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-sm font-medium text-ink hover:bg-sand xl:px-3 ${account.active ? 'bg-sand' : ''} ${focusRing}`}>
            <UserRound className="h-5 w-5" aria-hidden="true" /><span className="hidden xl:inline" aria-hidden="true">My account</span>
          </NavLink>
          <NavLink href="/designs" className={cta} id="nav-cta-start">Start an invitation</NavLink>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            ref={toggleRef}
            onClick={() => setIsOpen(true)}
            aria-label="Open menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu-drawer"
            className={`rounded-lg p-2.5 text-ink hover:bg-sand ${focusRing}`}
            id="mobile-menu-hamburger"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={close} aria-hidden="true" />
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Menu" id="mobile-menu-drawer" className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col bg-ivory p-6 shadow-card">
            <button onClick={close} aria-label="Close menu" className={`mb-6 self-end rounded-lg p-2.5 text-ink hover:bg-sand ${focusRing}`} id="mobile-menu-close">
              <X className="h-6 w-6" />
            </button>
            <ul className="flex flex-col">
              {[...items, account].map((it) => (
                <li key={it.href} className="border-b border-gold-light">
                  <NavLink
                    href={it.href}
                    onNavigate={close}
                    aria-current={it.active ? 'page' : undefined}
                    className={`block py-4 font-serif text-2xl text-ink ${focusRing}`}
                    id={`mobile-nav-${idOf(it.href)}`}
                  >
                    <span className={it.active ? underline : ''}>{it.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
            <NavLink href="/designs" onNavigate={close} className={`${cta} mt-8`} id="mobile-nav-cta">Start an invitation</NavLink>
          </div>
        </div>
      )}
    </header>
  );
}
