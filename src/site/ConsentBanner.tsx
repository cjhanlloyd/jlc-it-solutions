// Analytics consent for the Google tag (public/gtag.js). Shown until the visitor chooses; the footer's "Cookie settings"
// reopens it by dispatching OPEN_CONSENT. The choice is stored in localStorage as jlc_consent.
import React from 'react';
import { NavLink } from './NavLink';

export const OPEN_CONSENT = 'jlc:consent';
const KEY = 'jlc_consent';
// Same private routes public/gtag.js never measures
const PRIVATE = /^\/(checkin|c\/|manage|order\/)/;

const read = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };

export default function ConsentBanner() {
  const [open, setOpen] = React.useState(() => read() === null && !PRIVATE.test(window.location.pathname));
  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT, show);
    return () => window.removeEventListener(OPEN_CONSENT, show);
  }, []);

  const choose = (granted: boolean) => {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch { /* storage blocked: applies to this visit only */ }
    (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
    setOpen(false);
  };

  if (!open) return null;
  const btn = 'rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  return (
    <div role="region" aria-label="Cookie choices" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-card border border-gold-light bg-white p-4 text-ink shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <p className="text-sm leading-relaxed">
          We use Google Analytics cookies to understand how visitors use our site, only if you allow it.{' '}
          <NavLink href="/privacy" className="font-semibold text-brand-700 underline underline-offset-4">Privacy policy</NavLink>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => choose(false)} className={`${btn} border border-gold text-ink hover:bg-sand`}>Decline</button>
          <button type="button" onClick={() => choose(true)} className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>Accept</button>
        </div>
      </div>
    </div>
  );
}
