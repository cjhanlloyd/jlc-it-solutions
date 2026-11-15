/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, Facebook, Mail, MapPin, MessageCircle, Phone, PhoneCall } from 'lucide-react';
import { BrandingSettings, ContentSettings } from '../types.js';
import { NavLink } from '../site/NavLink';
import { occasionLabel } from '../invitations/occasions';
import { fetchDesigns } from '../site/designs-api';

interface FooterProps {
  branding: BrandingSettings;
  content: ContentSettings;
}

const HELP = [
  { href: '/track', label: 'Track order' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/refund-policy', label: 'Refund policy' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/contact', label: 'Contact' },
];
const COMPANY = [
  { href: '/about', label: 'About us' },
  { href: '/services', label: 'Other services' },
];

export default function Footer({ branding, content }: FooterProps) {
  const year = new Date().getFullYear();
  // Occasions with active designs, first-seen order; none if the request fails.
  const [occasions, setOccasions] = React.useState<string[]>([]);
  React.useEffect(() => { fetchDesigns().then((d) => setOccasions([...new Set(d.map((x) => x.productType))]), () => {}); }, []);
  const link = 'text-sm text-ivory/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light';
  const heading = 'mb-5 font-serif text-xl font-semibold text-white';
  const social = 'flex h-9 w-9 items-center justify-center rounded-full border border-gold/60 text-ivory hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light';

  return (
    <footer className="bg-brand-900 font-sans text-ivory" id="app-footer">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-5">
            <p className="font-serif text-3xl font-semibold text-white">{branding.companyName}</p>
            {branding.tagline && <p className="text-sm leading-relaxed text-ivory/85">{branding.tagline}</p>}
            <div className="flex items-center gap-3">
              {content.facebookUrl && (
                <a href={content.facebookUrl} target="_blank" rel="noopener noreferrer" className={social} aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
              )}
              {content.whatsappUrl && (
                <a href={content.whatsappUrl} target="_blank" rel="noopener noreferrer" className={social} aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
              )}
              {content.viberUrl && (
                <a href={content.viberUrl} target="_blank" rel="noopener noreferrer" className={social} aria-label="Viber"><PhoneCall className="h-4 w-4" /></a>
              )}
            </div>
          </div>

          <nav aria-label="Designs by occasion">
            <h2 className={heading}>Designs</h2>
            <ul className="space-y-3">
              {occasions.map((t) => (<li key={t}><NavLink href={`/designs?occasion=${encodeURIComponent(t)}`} className={link}>{occasionLabel(t)}</NavLink></li>))}
              <li><NavLink href="/designs" className={link}>All designs</NavLink></li>
            </ul>
          </nav>

          <nav aria-label="Help and company">
            <h2 className={heading}>Help</h2>
            <ul className="space-y-3">{HELP.map((l) => (<li key={l.href}><NavLink href={l.href} className={link}>{l.label}</NavLink></li>))}</ul>
            <h2 className={`${heading} mt-8`}>Company</h2>
            <ul className="space-y-3">{COMPANY.map((l) => (<li key={l.href}><NavLink href={l.href} className={link}>{l.label}</NavLink></li>))}</ul>
          </nav>

          <div>
            <h2 className={heading}>Get in touch</h2>
            <ul className="space-y-3 text-sm text-ivory/85">
              {content.contactEmail && <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><a href={`mailto:${content.contactEmail}`} className={link}>{content.contactEmail}</a></li>}
              {content.contactPhone && <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><a href={`tel:${content.contactPhone.replace(/\s/g, '')}`} className={link}>{content.contactPhone}</a></li>}
              {content.contactAddress && <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{content.contactAddress}</span></li>}
              {content.contactWorkingHours && <li className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{content.contactWorkingHours}</span></li>}
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-gold/50 pt-6 text-xs text-ivory/80">
          <p>© {year} {branding.companyName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
