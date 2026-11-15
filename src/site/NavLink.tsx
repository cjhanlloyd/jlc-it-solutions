// Site-shell link: a real <a>; a click on the page you are already on scrolls (to top or the #anchor) instead of pushing history.
import React from 'react';
import { go } from '../invitations/kit';

export function navTo(href: string) {
  if (href !== window.location.pathname + window.location.search + window.location.hash) return go(href);
  const id = href.split('#')[1];
  const target = id && document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function NavLink({ href, onNavigate, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: () => void }) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate?.();
        navTo(href);
      }}
    />
  );
}
