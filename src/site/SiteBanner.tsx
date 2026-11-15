// Slim announcement bar above the public navbar; dismissal lasts for the session, keyed by message text.
import React from 'react';
import { X } from 'lucide-react';
import { NavLink } from './NavLink';
import { fetchSite, type SiteContent } from './site-api';
import { isSafeLink } from '../../shared/links';

const key = (m: string) => `jlc_banner_dismissed:${m}`;
const dismissed = (m: string) => { try { return sessionStorage.getItem(key(m)) === '1'; } catch { return false; } };

export default function SiteBanner() {
  const [banner, setBanner] = React.useState<SiteContent['banner']>(null);
  React.useEffect(() => { fetchSite().then((s) => setBanner(s.banner && !dismissed(s.banner.message) ? s.banner : null), () => {}); }, []);
  if (!banner) return null;
  const link = banner.link && isSafeLink(banner.link) ? banner.link : null;
  const cls = 'ml-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  return (
    <div className="relative bg-brand-900 px-10 py-2.5 text-center text-sm text-ivory" role="region" aria-label="Announcement">
      <span>{banner.message}</span>
      {link && (link.startsWith('/')
        ? <NavLink href={link} className={cls}>Learn more</NavLink>
        : <a href={link} target="_blank" rel="noopener noreferrer" className={cls}>Learn more</a>)}
      <button type="button" aria-label="Dismiss announcement"
        onClick={() => { try { sessionStorage.setItem(key(banner.message), '1'); } catch { /* session only */ } setBanner(null); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
