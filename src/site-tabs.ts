// Hash tabs of the public site. No React imports: the node tests load this file directly.
export const SITE_TABS = ['shop', 'home', 'about', 'services', 'pricing', 'why', 'contact', 'inquiry', 'admin'] as const;

// null = a login route (the caller opens the login modal); anything unknown falls back to the shop.
export function tabFromHash(hash: string): string | null {
  const route = hash.split('?')[0].replace(/^#\/?/, '');
  if (route === 'login' || route === 'login/forgot-password') return null;
  return (SITE_TABS as readonly string[]).includes(route) ? route : 'shop';
}
