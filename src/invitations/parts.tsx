// Small pieces shared by the layouts and the guest page. Text is rendered only through JSX.
import { useEffect, useState, type CSSProperties } from 'react';
import type { Venue } from '../../shared/invitation-fields';
import { displaySafe, type InvitationStyle } from '../../shared/invitation-style';
import { ordinal } from '../../shared/occasions/birthday';
import type { InvitationDetails } from '../../shared/occasions/wedding';
import { coverOverlay, coverText, fontHref, fontPair, type CoverShown } from './style-render';

export type Scheme = { name?: string; primary: string; accent: string; background: string; text: string };

// The scheme becomes CSS variables, so every rule in invitations.css follows the couple's colors.
// A chosen font pair fills --serif/--sans (and Confetti's --round display face). InvitationView has already resolved 'Custom' colours.
export const schemeVars = (s: Scheme, style: InvitationStyle = {}) => {
  const f = fontPair(style);
  const fonts = f && { '--serif': `'${f.serif}', Georgia, serif`, '--sans': `'${f.sans}', system-ui, sans-serif`, '--round': `'${f.serif}', system-ui, sans-serif` };
  return { '--p': s.primary, '--a': s.accent, '--bg': s.background, '--fg': s.text, ...fonts } as CSSProperties;
};

// Display colours for the newer layouts only (older layouts keep --p/--a so their markup is unchanged):
// primary and accent nudged to 3:1 on the background, and on the text colour for Starlight's swapped sky.
export const displayVars = (s: Scheme) => ({
  '--pd': displaySafe(s.primary, s.background), '--ad': displaySafe(s.accent, s.background),
  '--pd-sky': displaySafe(s.primary, s.text), '--ad-sky': displaySafe(s.accent, s.text),
}) as CSSProperties;

// One stylesheet link per font pair in use, shared by every mounted invitation and removed with the last one.
const fontLinks = new Map<string, { el: HTMLLinkElement; users: number }>();
export function useStyleFonts(style?: InvitationStyle) {
  const href = fontHref(style);
  useEffect(() => {
    if (!href) return;
    let entry = fontLinks.get(href);
    if (!entry) {
      const el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = href;
      document.head.appendChild(el);
      fontLinks.set(href, (entry = { el, users: 0 }));
    }
    const e = entry;
    e.users++;
    return () => {
      if (--e.users === 0) { e.el.remove(); fontLinks.delete(href); }
    };
  }, [href]);
}

// The hero element's attributes: inv-cover plus the text colour that reads over the chosen overlay.
export const heroAttrs = (className: string, cover: CoverShown | null, primary: string) => {
  if (!cover) return { className: className || undefined };
  const t = coverText(cover.tone, primary);
  return {
    className: `${className} inv-cover${cover.fade ? ' inv-cover-faded' : ''}`.trim(),
    style: { '--cover-fg': t.color, '--cover-shadow': t.textShadow, '--cover-overlay': coverOverlay(cover.tone, cover.strength, primary) } as CSSProperties,
  };
};

// Decorative photo behind a hero: focal point (x%, y%), zoom around that point, a tone overlay and an optional fade.
export const Cover = ({ url, x, y, zoom, fade }: CoverShown) => (
  <div className="inv-cover-layer" aria-hidden="true">
    <img src={url} alt="" decoding="async" style={{ objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` }} />
    <span style={{ background: 'var(--cover-overlay)' }} />
    {fade && <span className="inv-cover-fade" />}
  </div>
);

export { formatDate, longDate, time12 } from '../../shared/occasions/card';

export const venues = (d: InvitationDetails) =>
  ([['Ceremony', d.ceremony], ['Reception', d.reception]] as [string, Venue | undefined][]).filter((x): x is [string, Venue] => !!x[1]?.name);

export const MapLink = ({ venue, className = 'btn' }: { venue: Venue; className?: string }) =>
  venue.mapUrl ? (
    <a className={className} href={venue.mapUrl} target="_blank" rel="noopener noreferrer">
      View map<span className="inv-sr"> for {venue.name} (opens in a new tab)</span>
    </a>
  ) : null;

// Days and hours until the event; renders nothing once it has started.
// shortcut: event times are read as Philippine time (UTC+8); store a timezone per invitation if couples abroad buy this.
export function Countdown({ details, className }: { details: { eventDate: string; eventTime: string }; className: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(`${details.eventDate}T${details.eventTime || '00:00'}:00+08:00`).getTime() - now;
  if (!(ms > 0)) return null;
  const days = Math.floor(ms / 86_400_000), hours = Math.floor(ms / 3_600_000) % 24;
  return (
    <p className={`cd ${className}`}>
      <span className="cd-unit"><span className="cd-num">{days}</span> <span className="cd-label">{days === 1 ? 'day' : 'days'}</span></span>{' '}
      <span className="cd-unit"><span className="cd-num">{hours}</span> <span className="cd-label">{hours === 1 ? 'hour' : 'hours'}</span></span>{' '}
      <span className="cd-unit"><span className="cd-label">to go</span></span>
    </p>
  );
}

export const photoAlt = (title: string, i: number, total: number) => `${title}, photo ${i + 1} of ${total}`;

// `start` skips photos a layout already showed elsewhere, keeping the alt numbering right.
export const Photos = ({ photos, title, className, start = 0 }: { photos: string[]; title: string; className: string; start?: number }) =>
  photos.length > start ? (
    <div className={className}>
      {photos.slice(start).map((src, i) => (
        <img key={src} src={src} loading="lazy" decoding="async" alt={photoAlt(title, i + start, photos.length)} />
      ))}
    </div>
  ) : null;

// 7 -> 7<sup>th</sup>
export const Ordinal = ({ n }: { n: number }) => <>{n}<sup>{ordinal(n).slice(String(n).length)}</sup></>;

export const Ornament = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 240 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 12H90M150 12H240" />
      <path d="M90 12c7-8 14-8 16-2M150 12c-7 8-14 8-16 2" />
      <path d="M120 4l8 8-8 8-8-8z" />
    </g>
    <circle cx="120" cy="12" r="2.2" fill="currentColor" />
    <circle cx="84" cy="12" r="1.4" fill="currentColor" />
    <circle cx="156" cy="12" r="1.4" fill="currentColor" />
  </svg>
);
