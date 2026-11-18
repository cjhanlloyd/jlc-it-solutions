// Path routes of the public site and redirects from legacy URLs. No React imports: the node tests load this file directly.
import type { PolicyKind } from '../invitations/PolicyPage.tsx';

export type Route =
  | { page: 'home' } | { page: 'designs' } | { page: 'design'; slug: string } | { page: 'customise'; slug: string }
  | { page: 'services' } | { page: 'about' } | { page: 'contact' }
  | { page: 'order'; ref: string } | { page: 'track' } | { page: 'manage' } | { page: 'account' } | { page: 'reviews' } | { page: 'policy'; kind: PolicyKind }
  | { page: 'checkin' } | { page: 'pass'; code: string }
  | { page: 'notFound' };

const SITE = ' | JLC Solutions';
export const PAGE_META: Record<Route['page'], { title: string; description: string }> = {
  home: { title: 'Digital Invitations' + SITE, description: 'Beautiful digital invitations you personalise, pay for with your preferred payment app and share with one link.' },
  designs: { title: 'Invitation Designs' + SITE, description: 'Browse our digital invitation designs for weddings, birthdays, debuts and more.' },
  design: { title: 'Invitation Design' + SITE, description: 'See this digital invitation design and personalise it with your event details.' },
  customise: { title: 'Customise Your Invitation' + SITE, description: 'Add your event details, preview your invitation live and place your order.' },
  services: { title: 'IT Services' + SITE, description: 'IT consulting, custom software and networks from JLC Solutions, with clear pricing.' },
  about: { title: 'About Us' + SITE, description: 'Who we are: a small, client-focused team making digital invitations and IT solutions.' },
  contact: { title: 'Contact Us' + SITE, description: 'Get in touch with JLC Solutions or send us an inquiry about your project.' },
  order: { title: 'Your Order' + SITE, description: 'Your invitation order: status, payment QR code and your invitation link.' },
  track: { title: 'Track Your Order' + SITE, description: 'Look up the status of your digital invitation order with your reference.' },
  manage: { title: 'Manage Your Invitation' + SITE, description: 'Get a link to manage your invitation, edit details and view RSVPs.' },
  account: { title: 'My Account' + SITE, description: 'Sign in with your email to see your invitations, share their links and manage your guests.' },
  reviews: { title: 'Customer Reviews' + SITE, description: 'What our clients say about their digital invitations from JLC Solutions.' },
  checkin: { title: 'Guest Check-in' + SITE, description: 'Door-phone check-in for event staff.' },
  pass: { title: 'Entry Pass' + SITE, description: 'A guest entry pass for an event.' },
  policy: { title: 'Policies' + SITE, description: 'Terms of service, refund policy and privacy policy of JLC Solutions.' },
  notFound: { title: 'Page Not Found' + SITE, description: 'This page could not be found. Browse our invitation designs or go to the homepage.' },
};

// #/<tab> links of the old hash-routed site → their new paths.
const LEGACY_TABS: Record<string, string> = {
  shop: '/', home: '/services', services: '/services', pricing: '/services#pricing', why: '/services#why',
  about: '/about', contact: '/contact', inquiry: '/contact',
};
const STATIC: Record<string, Route> = {
  designs: { page: 'designs' }, services: { page: 'services' }, about: { page: 'about' }, contact: { page: 'contact' },
  track: { page: 'track' }, checkin: { page: 'checkin' }, manage: { page: 'manage' }, account: { page: 'account' }, reviews: { page: 'reviews' },
  terms: { page: 'policy', kind: 'terms' }, 'refund-policy': { page: 'policy', kind: 'refund-policy' }, privacy: { page: 'policy', kind: 'privacy' },
};
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const NOT_FOUND = { route: { page: 'notFound' } } as const;

function decode(s: string): string | null {
  try { return decodeURIComponent(s); } catch { return null; }
}

export function routeFor(pathname: string, hash: string): { route: Route } | { redirect: string } {
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 0) {
    const tab = hash.split('?')[0].replace(/^#\/?/, '');
    if (own(LEGACY_TABS, tab)) return { redirect: LEGACY_TABS[tab] };
    return { route: { page: 'home' } }; // plain anchors (#how) and unknown hashes
  }
  if (seg[0] === 'invitations' && seg.length <= 2) return { redirect: seg[1] ? `/designs/${seg[1]}/customise` : '/designs' };
  if (seg.length === 1) return own(STATIC, seg[0]) ? { route: STATIC[seg[0]] } : NOT_FOUND;
  const value = decode(seg[1]);
  if (value === null) return NOT_FOUND;
  if (seg[0] === 'c' && seg.length === 2) return { route: { page: 'pass', code: value } };
  if (seg[0] === 'order' && seg.length === 2) return { route: { page: 'order', ref: value.toUpperCase() } };
  if (seg[0] === 'designs' && seg.length === 2) return { route: { page: 'design', slug: value } };
  if (seg[0] === 'designs' && seg.length === 3 && seg[2] === 'customise') return { route: { page: 'customise', slug: value } };
  return NOT_FOUND;
}

// A legacy redirect keeps the visitor's query string (ad UTM parameters) unless the target has its own.
export function withSearch(target: string, search: string): string {
  if (!search || target.includes('?')) return target;
  const i = target.indexOf('#');
  return i < 0 ? target + search : target.slice(0, i) + search + target.slice(i);
}

// Old admin URLs (invite/reset query links, #/admin and #/login hashes) → the /admin portal; null for any other URL.
export function legacyAdminRedirect(href: string): string | null {
  const u = new URL(href);
  if (u.pathname !== '/') return null;
  for (const [param, page] of [['inviteToken', 'invite'], ['resetToken', 'reset']] as const) {
    const token = u.searchParams.get(param);
    if (token) return `/admin#/${page}?email=${encodeURIComponent(u.searchParams.get('email') ?? '')}&token=${encodeURIComponent(token)}`;
  }
  return ['#/admin', '#/login', '#/login/forgot-password'].includes(u.hash) ? '/admin' : null;
}
